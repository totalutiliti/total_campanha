/**
 * Seed DEV — Total Campanha.
 *
 * Aborta com erro se NODE_ENV === 'production' (RULES 2.1 + BOOTSTRAP 0.3).
 *
 * Popula:
 *   - 1 tenant 'cardanstencar'
 *   - 2 users (admin + editor) com senha 'admin123' (Argon2id + pepper)
 *   - 10 contatos fake (faker pt-BR) com opt-in para ambos canais
 *   - 2 templates (1 email, 1 WhatsApp)
 *   - 1 segmento "Todos com opt-in WhatsApp"
 */

import * as crypto from 'node:crypto';

import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

faker.seed(20260519);

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

if (process.env.NODE_ENV === 'production') {
  console.error('[seed] PROIBIDO rodar seed em PROD (RULES 2.1).');
  process.exit(1);
}

const prisma = new PrismaClient();

function hashEmail(email: string, pepper: string): string {
  return crypto.createHash('sha256').update(`${email.toLowerCase()}${pepper}`).digest('hex');
}

async function hashPassword(plain: string, pepper: string): Promise<string> {
  return argon2.hash(`${plain}${pepper}`, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 64 * 1024,
    parallelism: 4,
  });
}

async function main(): Promise<void> {
  const pepper = process.env.AUTH_PEPPER;
  if (!pepper) {
    throw new Error('[seed] AUTH_PEPPER ausente no .env (RULES 3.1).');
  }

  console.log('[seed] limpando dados de DEV...');
  // Apaga em ordem para respeitar FKs. RLS está ativo, mas como rodamos com role
  // de migração (BYPASSRLS) via DATABASE_MIGRATION_URL, conseguimos limpar tudo.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE /* SAFE: seed dev-only — aborta se NODE_ENV=production (ver topo do arquivo) */
    inbox_mensagens, inbox_conversas,
    audit_logs, opt_in_logs,
    conexoes_email, conexoes_whatsapp,
    mensagens, campanhas, templates, segmentos, contatos,
    user_tenants, users, tenants, usage_logs RESTART IDENTITY CASCADE`);

  console.log('[seed] criando tenant cardanstencar...');
  const tenant = await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      slug: 'cardanstencar',
      cnpj: '11222333000144',
      razaoSocial: 'Cardans Tencar Autopeças LTDA',
      plano: 'STARTER',
      status: 'TRIAL',
      trialAteEm: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('[seed] criando users...');
  const adminEmail = 'admin@cardanstencar.dev';
  const editorEmail = 'editor@cardanstencar.dev';

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      emailHash: hashEmail(adminEmail, pepper),
      passwordHash: await hashPassword('admin123', pepper),
    },
  });

  const editor = await prisma.user.create({
    data: {
      email: editorEmail,
      emailHash: hashEmail(editorEmail, pepper),
      passwordHash: await hashPassword('admin123', pepper),
    },
  });

  await prisma.userTenant.createMany({
    data: [
      { userId: admin.id, tenantId: tenant.id, role: 'ADMIN' },
      { userId: editor.id, tenantId: tenant.id, role: 'EDITOR_CAMPANHA' },
    ],
  });

  console.log('[seed] criando 10 contatos fake (pt-BR)...');
  const contatosData = Array.from({ length: 10 }, () => {
    const nome = faker.person.fullName();
    const empresa = faker.company.name();
    return {
      tenantId: tenant.id,
      nome: `${nome} — ${empresa}`,
      email: faker.internet.email({ provider: 'cardanstencar.example' }).toLowerCase(),
      telefoneE164: `+5511${faker.string.numeric(9)}`,
      tags: ['cliente-ativo', faker.helpers.arrayElement(['regiao-oeste', 'regiao-leste'])],
      extras: { empresa, segmento: 'autopecas' },
      optInEmail: true,
      optInWhatsapp: true,
      optInMeta: {
        ip: '127.0.0.1',
        ua: 'seed',
        origem: 'seed-dev',
        versao: process.env.CURRENT_OPT_IN_TERM_VERSION ?? '2026-05-01',
        ts: new Date().toISOString(),
      },
    };
  });
  await prisma.contato.createMany({ data: contatosData });

  console.log('[seed] criando templates (email + whatsapp)...');
  await prisma.template.create({
    data: {
      tenantId: tenant.id,
      canal: 'EMAIL',
      nome: 'Boas-vindas Cardans',
      assunto: 'Bem-vindo, {{nome}}!',
      mjml:
        '<mjml><mj-body><mj-section><mj-column>' +
        '<mj-text>Olá {{nome}}, obrigado por se cadastrar na Cardans Tencar.</mj-text>' +
        '</mj-column></mj-section></mj-body></mjml>',
      variaveis: [{ key: 'nome', exemplo: 'João' }],
    },
  });

  await prisma.template.create({
    data: {
      tenantId: tenant.id,
      canal: 'WHATSAPP',
      nome: 'Promoção Barras de Direção',
      metaTemplateName: 'promocao_barras_direcao_mb',
      metaLanguage: 'pt_BR',
      variaveis: [
        { key: 'nome', exemplo: 'João' },
        { key: 'produto', exemplo: 'Barra de Direção Curta MB 1418' },
        { key: 'preco', exemplo: 'R$ 487,00' },
      ],
    },
  });

  console.log('[seed] criando segmento "Todos com opt-in WhatsApp"...');
  await prisma.segmento.create({
    data: {
      tenantId: tenant.id,
      nome: 'Todos com opt-in WhatsApp',
      filtros: {
        modo: 'and',
        condicoes: [{ campo: 'opt_in_whatsapp', operador: 'has_opt_in_whatsapp', valor: true }],
      },
    },
  });

  console.log('[seed] OK.');
  console.log(`  tenant slug: cardanstencar (id: ${tenant.id})`);
  console.log(`  login admin: ${adminEmail} / admin123`);
  console.log(`  login editor: ${editorEmail} / admin123`);
}

main()
  .catch((err) => {
    console.error('[seed] erro:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
