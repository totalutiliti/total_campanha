import { z } from 'zod';

const booleanString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true'));

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  APP_NAME: z.string().default('total-campanha'),
  TZ: z.string().default('America/Sao_Paulo'),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_BASE_URL: z.string().url().default('http://localhost:3001'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  DATABASE_APP_URL: z.string().min(1).optional(),
  DATABASE_MIGRATION_URL: z.string().min(1).optional(),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  BULLMQ_PREFIX: z.string().default('tc'),

  // RULES 3.1 — pepper para Argon2id, e RULES 3.2 — pepper do email hash.
  AUTH_PEPPER: z.string().min(32, 'AUTH_PEPPER deve ter no mínimo 32 caracteres'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_TTL: z.string().default('7d'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: booleanString.default(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  PASSWORD_RESET_TTL_MIN: z.coerce.number().int().positive().default(60),

  TOKEN_KMS_KEY: z.string().min(16),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(8).optional(),
  META_GRAPH_VERSION: z.string().default('v22.0'),
  META_GRAPH_BASE_URL: z.string().url().default('https://graph.facebook.com'),

  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_WINDOW_MIN: z.coerce.number().int().positive().default(15),

  CURRENT_OPT_IN_TERM_VERSION: z.string().default('2026-05-01'),
  OPT_OUT_TOKEN_SECRET: z.string().min(16).optional(),

  // Mail
  MAIL_PROVIDER: z.enum(['smtp', 'ses', 'resend']).default('smtp'),
  MAIL_FROM_DEFAULT: z.string().default('Total Campanha <no-reply@totalcampanha.dev>'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: booleanString.default(false),

  // Imports
  CONTATOS_IMPORTAR_SYNC_LIMITE: z.coerce.number().int().positive().default(1000),

  // reCAPTCHA (opt-in público)
  RECAPTCHA_SECRET: z.string().optional(),

  // URLs públicas para construir links em emails
  PUBLIC_OPT_IN_BASE_URL: z.string().url().default('http://localhost:3000/p/opt-in'),
  PUBLIC_OPT_OUT_BASE_URL: z.string().url().default('http://localhost:3000/p/opt-out'),
  // Base do app web (links de redefinição de senha etc). Se ausente, derivamos
  // a origem de PUBLIC_OPT_IN_BASE_URL.
  WEB_BASE_URL: z.string().url().optional(),

  // Webhooks Meta — URL pública onde a Meta envia eventos por tenant.
  // Em PROD: https://api.totalcampanha.com.br/api/v1/webhooks/meta/{tenantSlug}
  WEBHOOK_META_BASE_URL: z
    .string()
    .url()
    .default('http://localhost:3001/api/v1/webhooks/meta'),

  // AWS (SES — Fase 4.2). Em DEV sem credenciais, o adapter cai para stub.
  AWS_REGION: z.string().default('sa-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SES_CONFIGURATION_SET: z.string().optional(),

  // Billing — Asaas (Fase 6.2). Em DEV sem ASAAS_API_KEY, o client cai para stub.
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_BASE_URL: z.string().url().default('https://www.asaas.com/api/v3'),
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const detalhe = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`[env] variáveis inválidas:\n${detalhe}`);
  }
  const env = parsed.data;
  // Validações cruzadas — configurações que, ausentes, falhariam só em runtime.
  if (env.MAIL_PROVIDER === 'ses' && (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY)) {
    throw new Error('[env] MAIL_PROVIDER=ses exige AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY.');
  }
  if (env.ASAAS_API_KEY && !env.ASAAS_WEBHOOK_TOKEN) {
    throw new Error(
      '[env] ASAAS_API_KEY configurada sem ASAAS_WEBHOOK_TOKEN — o webhook de billing ficaria aberto.',
    );
  }
  return env;
}
