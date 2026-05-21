// Enums espelhando docs/SPECS.md seção 1 (Prisma schema).
// Mantidos como union types para uso no front e em DTOs sem depender de @prisma/client.

export const PLANO = ['STARTER', 'PRO', 'ENTERPRISE'] as const;
export type Plano = (typeof PLANO)[number];

export const TENANT_STATUS = ['TRIAL', 'ATIVO', 'INADIMPLENTE', 'SUSPENSO', 'CANCELADO'] as const;
export type TenantStatus = (typeof TENANT_STATUS)[number];

export const ROLE = ['ADMIN', 'EDITOR_CAMPANHA', 'VISUALIZADOR'] as const;
// `Role` é const-objeto + tipo de mesmo nome (padrão enum-like): permite
// `Role.ADMIN` como valor e `Role` em posição de tipo.
export const Role = {
  ADMIN: 'ADMIN',
  EDITOR_CAMPANHA: 'EDITOR_CAMPANHA',
  VISUALIZADOR: 'VISUALIZADOR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const CANAL = ['EMAIL', 'WHATSAPP'] as const;
export type Canal = (typeof CANAL)[number];

export const STATUS_CAMPANHA = [
  'RASCUNHO',
  'AGENDADA',
  'DISPARANDO',
  'PAUSADA',
  'FINALIZADA',
  'CANCELADA',
] as const;
export type StatusCampanha = (typeof STATUS_CAMPANHA)[number];

export const STATUS_MENSAGEM = [
  'PENDENTE',
  'ENFILEIRADA',
  'ENVIADA',
  'ENTREGUE',
  'LIDA',
  'RESPONDIDA',
  'FALHOU',
  'CANCELADA',
] as const;
export type StatusMensagem = (typeof STATUS_MENSAGEM)[number];

export const TIER_META = ['TIER_250', 'TIER_1K', 'TIER_10K', 'TIER_100K', 'TIER_UNLIMITED'] as const;
export type TierMeta = (typeof TIER_META)[number];

export const STATUS_CONEXAO = ['PENDENTE_VERIFICACAO', 'ATIVA', 'SUSPENSA', 'ERRO'] as const;
export type StatusConexao = (typeof STATUS_CONEXAO)[number];

export const OPT_IN_ACAO = ['OPT_IN', 'OPT_OUT'] as const;
export type OptInAcao = (typeof OPT_IN_ACAO)[number];
