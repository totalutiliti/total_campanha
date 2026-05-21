/**
 * Suíte de isolamento cross-tenant ao nível do banco (RLS).
 *
 * Para cada entidade tenant-scoped, testa as 4 violações clássicas (RULES 1.5):
 *   1. Leitura cross-tenant — não enxerga.
 *   2. List sem filtro — só retorna do próprio tenant.
 *   3. Update via id de outro tenant — não atualiza.
 *   4. Delete via id de outro tenant — não deleta.
 *
 * Roda como `app_user` (RLS ativo) via helper `comTenant()`, que faz exatamente
 * o `SET LOCAL app.current_tenant` que o PrismaService.runInTenant faz em runtime.
 *
 * **Quando esta suíte falha, NADA mais merge.** É gate do CI (RULES 1.5).
 */
import type { PrismaClient } from '@prisma/client';

import {
  comTenant,
  encerrarIsolationContext,
  iniciarIsolationContext,
  IsolationContext,
} from './setup.js';

let ctx: IsolationContext;

beforeAll(async () => {
  ctx = await iniciarIsolationContext();
}, 300_000);

afterAll(async () => {
  await encerrarIsolationContext(ctx);
});

interface Fixtures {
  contato: { a: string; b: string };
  segmento: { a: string; b: string };
  template: { a: string; b: string };
  campanha: { a: string; b: string };
  mensagem: { a: string; b: string };
  conexaoWhatsapp: { a: string; b: string };
  conexaoEmail: { a: string; b: string };
}

const fixtures: Fixtures = {
  contato: { a: '', b: '' },
  segmento: { a: '', b: '' },
  template: { a: '', b: '' },
  campanha: { a: '', b: '' },
  mensagem: { a: '', b: '' },
  conexaoWhatsapp: { a: '', b: '' },
  conexaoEmail: { a: '', b: '' },
};

beforeAll(async () => {
  // Cria 1 registro de cada entidade em cada tenant — usando adminPrisma (BYPASSRLS).
  const tenants = [ctx.tenantA.id, ctx.tenantB.id] as const;

  for (const t of tenants) {
    const contato = await ctx.adminPrisma.contato.create({
      data: {
        tenantId: t,
        email: `${t}@x.com`,
        telefoneE164: t === ctx.tenantA.id ? '+5511900000001' : '+5511900000002',
        tags: [],
        extras: {},
        optInEmail: true,
        optInWhatsapp: true,
      },
    });
    fixtures.contato[t === ctx.tenantA.id ? 'a' : 'b'] = contato.id;

    const segmento = await ctx.adminPrisma.segmento.create({
      data: { tenantId: t, nome: `segmento ${t}`, filtros: { modo: 'and', condicoes: [] } },
    });
    fixtures.segmento[t === ctx.tenantA.id ? 'a' : 'b'] = segmento.id;

    const template = await ctx.adminPrisma.template.create({
      data: {
        tenantId: t,
        canal: 'EMAIL',
        nome: `template ${t}`,
        assunto: 'Olá {{nome}}',
        variaveis: [],
      },
    });
    fixtures.template[t === ctx.tenantA.id ? 'a' : 'b'] = template.id;

    const campanha = await ctx.adminPrisma.campanha.create({
      data: {
        tenantId: t,
        nome: `campanha ${t}`,
        segmentoId: segmento.id,
        templateId: template.id,
        canal: 'EMAIL',
        status: 'RASCUNHO',
      },
    });
    fixtures.campanha[t === ctx.tenantA.id ? 'a' : 'b'] = campanha.id;

    const mensagem = await ctx.adminPrisma.mensagem.create({
      data: {
        tenantId: t,
        campanhaId: campanha.id,
        contatoId: contato.id,
        canal: 'EMAIL',
        status: 'PENDENTE',
      },
    });
    fixtures.mensagem[t === ctx.tenantA.id ? 'a' : 'b'] = mensagem.id;

    const conexaoW = await ctx.adminPrisma.conexaoWhatsapp.create({
      data: {
        tenantId: t,
        wabaId: `waba-${t}`,
        phoneNumberId: `pnid-${t}`,
        tokenEncrypted: Buffer.from('placeholder'),
        webhookSecret: `secret-${t}`,
      },
    });
    fixtures.conexaoWhatsapp[t === ctx.tenantA.id ? 'a' : 'b'] = conexaoW.id;

    const conexaoE = await ctx.adminPrisma.conexaoEmail.create({
      data: {
        tenantId: t,
        dominio: `${t}.example.com`,
        remetente: `no-reply@${t}.example.com`,
        dkimStatus: 'pending',
        spfStatus: 'pending',
      },
    });
    fixtures.conexaoEmail[t === ctx.tenantA.id ? 'a' : 'b'] = conexaoE.id;
  }
});

// ---------------------------------------------------------------------------
// Helper genérico — cada entidade vira um sub-describe com 4 testes.
// ---------------------------------------------------------------------------
interface Caso<TModel extends keyof PrismaClient> {
  nome: string;
  modelo: TModel;
  idA: () => string;
  idB: () => string;
  dadosUpdate: Record<string, unknown>;
}

function entidadeAcessor(tx: PrismaClient, modelo: keyof PrismaClient): {
  findUnique: (args: { where: { id: string } }) => Promise<unknown>;
  findMany: () => Promise<unknown[]>;
  updateMany: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ count: number }>;
  deleteMany: (args: { where: { id: string } }) => Promise<{ count: number }>;
} {
  // Cada model do Prisma Client expõe esses 4 métodos; tipagem dinâmica para
  // permitir iteração — alternativa seria 7 blocos quase idênticos.
  return tx[modelo] as never;
}

function rodarCasos<TModel extends keyof PrismaClient>(caso: Caso<TModel>) {
  describe(`Isolamento — ${caso.nome}`, () => {
    test('leitura cross-tenant retorna null', async () => {
      const resultado = await comTenant(ctx.appPrisma, ctx.tenantB.id, async (tx) => {
        return entidadeAcessor(tx as PrismaClient, caso.modelo).findUnique({
          where: { id: caso.idA() },
        });
      });
      expect(resultado).toBeNull();
    });

    test('list só retorna do próprio tenant', async () => {
      const itens = await comTenant(ctx.appPrisma, ctx.tenantB.id, async (tx) => {
        return entidadeAcessor(tx as PrismaClient, caso.modelo).findMany();
      });
      // Não pode aparecer o id do tenant A.
      const ids = (itens as Array<{ id: string }>).map((i) => i.id);
      expect(ids).not.toContain(caso.idA());
      // Mas deve conter o id do tenant B.
      expect(ids).toContain(caso.idB());
    });

    test('updateMany por id de outro tenant afeta 0 linhas', async () => {
      const r = await comTenant(ctx.appPrisma, ctx.tenantB.id, async (tx) => {
        return entidadeAcessor(tx as PrismaClient, caso.modelo).updateMany({
          where: { id: caso.idA() },
          data: caso.dadosUpdate,
        });
      });
      expect(r.count).toBe(0);
    });

    test('deleteMany por id de outro tenant afeta 0 linhas', async () => {
      const r = await comTenant(ctx.appPrisma, ctx.tenantB.id, async (tx) => {
        return entidadeAcessor(tx as PrismaClient, caso.modelo).deleteMany({
          where: { id: caso.idA() },
        });
      });
      expect(r.count).toBe(0);
    });
  });
}

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------
describe('tenant isolation', () => {
  rodarCasos({
    nome: 'Contato',
    modelo: 'contato',
    idA: () => fixtures.contato.a,
    idB: () => fixtures.contato.b,
    dadosUpdate: { nome: 'hack' },
  });

  rodarCasos({
    nome: 'Segmento',
    modelo: 'segmento',
    idA: () => fixtures.segmento.a,
    idB: () => fixtures.segmento.b,
    dadosUpdate: { nome: 'hack' },
  });

  rodarCasos({
    nome: 'Template',
    modelo: 'template',
    idA: () => fixtures.template.a,
    idB: () => fixtures.template.b,
    dadosUpdate: { nome: 'hack' },
  });

  rodarCasos({
    nome: 'Campanha',
    modelo: 'campanha',
    idA: () => fixtures.campanha.a,
    idB: () => fixtures.campanha.b,
    dadosUpdate: { nome: 'hack' },
  });

  rodarCasos({
    nome: 'Mensagem',
    modelo: 'mensagem',
    idA: () => fixtures.mensagem.a,
    idB: () => fixtures.mensagem.b,
    dadosUpdate: { falhaMotivo: 'hack' },
  });

  rodarCasos({
    nome: 'ConexaoWhatsapp',
    modelo: 'conexaoWhatsapp',
    idA: () => fixtures.conexaoWhatsapp.a,
    idB: () => fixtures.conexaoWhatsapp.b,
    dadosUpdate: { qualityRating: 'red' },
  });

  rodarCasos({
    nome: 'ConexaoEmail',
    modelo: 'conexaoEmail',
    idA: () => fixtures.conexaoEmail.a,
    idB: () => fixtures.conexaoEmail.b,
    dadosUpdate: { dkimStatus: 'hack' },
  });
});

// ---------------------------------------------------------------------------
// Bônus: INSERT cross-tenant via WITH CHECK.
// ---------------------------------------------------------------------------
describe('tenant isolation — write guard (WITH CHECK)', () => {
  test('INSERT em nome de outro tenant é bloqueado', async () => {
    await expect(
      comTenant(ctx.appPrisma, ctx.tenantB.id, async (tx) => {
        await tx.contato.create({
          data: {
            tenantId: ctx.tenantA.id, // tenta cravar A enquanto a sessão é B
            email: 'forge@a.com',
            tags: [],
            extras: {},
            optInEmail: false,
            optInWhatsapp: false,
          },
        });
      }),
    ).rejects.toThrow();
  });
});
