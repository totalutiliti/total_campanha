import { z } from 'zod';

/**
 * Env do worker. Subconjunto do env da API — só o necessário para consumir
 * filas e gravar no banco respeitando RLS.
 */
export const WorkerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  TZ: z.string().default('America/Sao_Paulo'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  BULLMQ_PREFIX: z.string().default('tc'),
  AUTH_PEPPER: z.string().min(32),
  TOKEN_KMS_KEY: z.string().min(16),

  // AWS SES (Fase 4.2 — job recorrente verifica DKIM via SES GetEmailIdentity)
  AWS_REGION: z.string().default('sa-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Meta Graph (dispatch WhatsApp — Fase 5.2)
  META_GRAPH_BASE_URL: z.string().url().default('https://graph.facebook.com'),
  META_GRAPH_VERSION: z.string().default('v22.0'),

  // SMTP (dispatch Email — Fase 5.2)
  MAIL_FROM_DEFAULT: z.string().default('Total Campanha <no-reply@totalcampanha.dev>'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),

  // URLs públicas (unsubscribe header / tracking pixel)
  API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  PUBLIC_OPT_OUT_BASE_URL: z.string().url().default('http://localhost:3000/p/opt-out'),

  // Alertas (falha em massa — RULES 7.4)
  SLACK_WEBHOOK_URL: z.string().optional(),

  // Versão do termo de opt-in — usada no opt-out automático via webhook.
  CURRENT_OPT_IN_TERM_VERSION: z.string().default('2026-05-01'),
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv): WorkerEnv {
  const parsed = WorkerEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const detalhe = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`[worker/env] variáveis inválidas:\n${detalhe}`);
  }
  return parsed.data;
}
