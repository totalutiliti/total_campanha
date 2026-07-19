/**
 * Lista única de verdade das tabelas tenant-scoped que precisam ter RLS habilitado.
 *
 * - Usada pela migration `0002_enable_rls.sql` (idealmente gerada a partir desta lista)
 * - Usada pelos testes `tests/rls.test.ts` para validar que cada tabela tem RLS ativo
 *
 * Tabelas globais (Tenant, User, UserTenant, UsageLog) NÃO entram aqui — sem RLS.
 * Ver docs/SPECS.md seção 1 e docs/RULES.md seção 1.
 */
export const RLS_TENANT_TABLES = [
  'contatos',
  'segmentos',
  'templates',
  'campanhas',
  'mensagens',
  'conexoes_whatsapp',
  'conexoes_email',
  'opt_in_logs',
  'consentimentos_pendentes',
  'webhook_eventos',
  'audit_logs',
  'inbox_conversas',
  'inbox_mensagens',
] as const;

export type RlsTenantTable = (typeof RLS_TENANT_TABLES)[number];
