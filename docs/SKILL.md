# SKILL — Total Campanha (padrões de código)

> Exemplos de implementação canônicos. Quando o Antigravity gera código novo, deve seguir estes padrões. Em caso de dúvida entre dois padrões, este documento é o desempate.

## 1. Estrutura de módulo NestJS (padrão CRUD)

Cada módulo de domínio segue exatamente esta estrutura:

```
modules/contatos/
├── contatos.module.ts
├── contatos.controller.ts
├── contatos.service.ts
├── dto/
│   ├── criar-contato.dto.ts
│   ├── atualizar-contato.dto.ts
│   └── listar-contatos.dto.ts
├── importar/
│   ├── importar-contatos.service.ts
│   └── parser-csv.ts
└── contatos.service.spec.ts
```

## 2. DTO com Zod

```typescript
// dto/criar-contato.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CriarContatoSchema = z.object({
  nome: z.string().min(1).max(200).optional(),
  email: z.string().email().toLowerCase().optional(),
  telefoneE164: z.string().regex(/^\+\d{10,15}$/).optional(),
  tags: z.array(z.string()).default([]),
  extras: z.record(z.unknown()).default({}),
}).refine(
  data => data.email || data.telefoneE164,
  { message: 'É obrigatório informar email ou telefone' }
);

export class CriarContatoDto extends createZodDto(CriarContatoSchema) {}
```

## 3. Controller com guards e validação

```typescript
// contatos.controller.ts
import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/auth/jwt-auth.guard';
import { TenantRoleGuard } from '@/common/rbac/tenant-role.guard';
import { Role, Roles } from '@/common/rbac/roles.decorator';
import { TenantId } from '@/common/tenant/tenant-id.decorator';
import { ContatosService } from './contatos.service';
import { CriarContatoDto } from './dto/criar-contato.dto';

@Controller('contatos')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class ContatosController {
  constructor(private readonly contatos: ContatosService) {}

  @Post()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  criar(
    @TenantId() tenantId: string,
    @Body() dto: CriarContatoDto,
  ) {
    return this.contatos.criar(tenantId, dto);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  buscar(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.contatos.buscar(tenantId, id);
  }
}
```

**Regras:**
- `@UseGuards(JwtAuthGuard, TenantRoleGuard)` no controller, sempre.
- `@Roles(...)` em cada handler, sempre. Sem default permissivo.
- `tenantId` via decorator, nunca do body/param.

## 4. Service com Prisma + RLS

```typescript
// contatos.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/common/audit/audit.service';
import { CriarContatoDto } from './dto/criar-contato.dto';

@Injectable()
export class ContatosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async criar(tenantId: string, dto: CriarContatoDto) {
    return this.prisma.runInTenant(tenantId, async (tx) => {
      const contato = await tx.contato.create({
        data: {
          tenantId,
          ...dto,
        },
      });
      await this.audit.log(tenantId, null, 'contato.criar', contato.id, { dto });
      return contato;
    });
  }

  async buscar(tenantId: string, id: string) {
    const contato = await this.prisma.runInTenant(tenantId, async (tx) => {
      return tx.contato.findUnique({ where: { id } });
    });
    if (!contato) throw new NotFoundException('Contato não encontrado');
    return contato;
  }
}
```

**Padrão `runInTenant`:**

```typescript
// common/prisma/prisma.service.ts (trecho)
async runInTenant<T>(tenantId: string, fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
  return this.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
    return fn(tx);
  });
}
```

⚠️ **Não interpolar `tenantId` direto em SQL externamente.** O método `runInTenant` recebe `tenantId` que já veio do JWT (validado), e o uso de `SET LOCAL` aceita string literal. Aqui o SQL injection vector está controlado porque a fonte é o JWT do nosso próprio sistema — mas se um dia mudar a fonte, usar `$executeRaw` com tagged template.

## 5. Worker BullMQ (dispatch WhatsApp)

```typescript
// workers/dispatch-whatsapp.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MetaWhatsappClient } from '@/common/integrations/meta-whatsapp.client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UsageService } from '@/common/usage/usage.service';
import { CryptoService } from '@/common/crypto/crypto.service';

interface DispatchJob {
  mensagemId: string;
  tenantId: string;
}

@Processor('dispatch:whatsapp', {
  concurrency: 5,
  limiter: { max: 10, duration: 60_000 }, // 10/min default, override por tenant
})
export class DispatchWhatsappProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaWhatsappClient,
    private readonly usage: UsageService,
    private readonly crypto: CryptoService,
  ) { super(); }

  async process(job: Job<DispatchJob>): Promise<void> {
    const { mensagemId, tenantId } = job.data;

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const msg = await tx.mensagem.findUnique({
        where: { id: mensagemId },
        include: { contato: true, campanha: { include: { template: true } } },
      });
      if (!msg) throw new Error('Mensagem não encontrada');

      const conexao = await tx.conexaoWhatsapp.findUnique({ where: { tenantId } });
      if (!conexao || conexao.status !== 'ATIVA') {
        await tx.mensagem.update({
          where: { id: mensagemId },
          data: { status: 'FALHOU', falhaMotivo: 'Conexão WhatsApp inativa' },
        });
        return;
      }

      const token = await this.crypto.decryptToken(conexao.tokenEncrypted);

      const resultado = await this.metaClient.sendTemplate({
        phoneNumberId: conexao.phoneNumberId,
        token,
        to: msg.contato.telefoneE164!,
        templateName: msg.campanha.template.metaTemplateName!,
        language: msg.campanha.template.metaLanguage!,
        variables: this.interpolar(msg.campanha.template.variaveis, msg.contato),
      });

      await tx.mensagem.update({
        where: { id: mensagemId },
        data: {
          status: 'ENVIADA',
          enviadaEm: new Date(),
          providerMessageId: resultado.messages[0].id,
          custoEstimadoBrl: 0.25,
          statusHistory: { push: { status: 'ENVIADA', at: new Date() } },
        },
      });

      await this.usage.log(tenantId, 'meta.whatsapp.marketing.br', 0.25, {
        mensagemId,
        providerMessageId: resultado.messages[0].id,
      });
    });
  }

  private interpolar(variaveis: any[], contato: any): Record<string, string> {
    // ...
    return {};
  }
}
```

## 6. Webhook Meta (entrada)

```typescript
// modules/webhooks/meta.controller.ts
@Controller('webhooks/meta')
export class MetaWebhookController {
  constructor(
    @InjectQueue('webhook:meta') private readonly fila: Queue,
    private readonly prisma: PrismaService,
  ) {}

  // Verificação (handshake Meta)
  @Get(':tenantSlug')
  async verificar(
    @Param('tenantSlug') slug: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException();
    const conexao = await this.prisma.conexaoWhatsapp.findUnique({ where: { tenantId: tenant.id } });
    if (mode === 'subscribe' && verifyToken === conexao?.webhookSecret) {
      return challenge;
    }
    throw new ForbiddenException();
  }

  // Recebe eventos
  @Post(':tenantSlug')
  async receber(
    @Param('tenantSlug') slug: string,
    @Body() payload: any,
  ) {
    // Não processa síncronamente; só enfileira. Meta tem timeout de 5s.
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return { ok: true }; // 200 mesmo sem tenant para Meta não reenviar
    await this.fila.add('processar', { tenantId: tenant.id, payload });
    return { ok: true };
  }
}
```

## 7. Teste de isolamento cross-tenant

```typescript
// test/tenant-isolation/contatos.spec.ts
describe('Contatos — isolamento cross-tenant', () => {
  let tenantA: string, tenantB: string;
  let contatoA: string;

  beforeAll(async () => {
    tenantA = (await criarTenant('a')).id;
    tenantB = (await criarTenant('b')).id;
    contatoA = (await criarContato(tenantA, { email: 'x@a.com' })).id;
  });

  it('leitura cross-tenant retorna não encontrado', async () => {
    const res = await api
      .get(`/contatos/${contatoA}`)
      .set('Authorization', `Bearer ${tokenDo(tenantB)}`)
      .expect(404);
  });

  it('list só retorna contatos do próprio tenant', async () => {
    const res = await api
      .get('/contatos')
      .set('Authorization', `Bearer ${tokenDo(tenantB)}`)
      .expect(200);
    expect(res.body.itens.find(c => c.id === contatoA)).toBeUndefined();
  });

  it('update cross-tenant via id retorna não encontrado', async () => {
    await api
      .patch(`/contatos/${contatoA}`)
      .set('Authorization', `Bearer ${tokenDo(tenantB)}`)
      .send({ nome: 'Hacker' })
      .expect(404);
  });

  it('delete cross-tenant via id retorna não encontrado', async () => {
    await api
      .delete(`/contatos/${contatoA}`)
      .set('Authorization', `Bearer ${tokenDo(tenantB)}`)
      .expect(404);
  });
});
```

## 8. Frontend Next.js — formulário com validação

```tsx
// app/(tenant)/contatos/novo/page.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CriarContatoSchema } from '@/lib/api/contatos/schemas';

export default function NovoContato() {
  const form = useForm({
    resolver: zodResolver(CriarContatoSchema),
    defaultValues: { tags: [], extras: {} },
  });

  async function onSubmit(values: z.infer<typeof CriarContatoSchema>) {
    await api.post('/contatos', values);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* shadcn/ui Form components */}
    </form>
  );
}
```

## 9. Decorator de tenantId

```typescript
// common/tenant/tenant-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (_, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new Error('TenantId ausente no JWT');
    return tenantId;
  },
);
```

## 10. Versionamento de templates de email

```typescript
// modules/templates/templates.service.ts
async atualizar(tenantId: string, id: string, mjml: string) {
  return this.prisma.runInTenant(tenantId, async (tx) => {
    const atual = await tx.template.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException();
    // Versionamento: grava versão anterior em tabela TemplateVersao
    await tx.templateVersao.create({
      data: { templateId: id, mjml: atual.mjml!, criadoEm: atual.atualizadoEm },
    });
    return tx.template.update({ where: { id }, data: { mjml } });
  });
}
```

## Anti-padrões (NÃO fazer)

- ❌ `tenant_id` vindo de `req.body` ou `req.query`.
- ❌ Query Prisma sem `runInTenant`.
- ❌ `console.log(token)` ou logar request body bruto.
- ❌ `prisma.contato.findUnique({ where: { id } })` sem o filtro implícito de RLS (sem `runInTenant`).
- ❌ Catch genérico que esconde o erro: `catch (e) { return null }`.
- ❌ `any` no TypeScript.
- ❌ Senha em texto puro em qualquer lugar, mesmo log de debug.
- ❌ Hardcoded URL de Meta (`https://graph.facebook.com/v22.0/...`) espalhado pelo código — centralizar em config.
- ❌ Emoji em código (admitido só em mensagens de UI quando faz sentido).
- ❌ Comentário explicando o que o código faz; comentário explicando *por que* tudo bem.
