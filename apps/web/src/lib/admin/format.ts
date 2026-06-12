/**
 * Helpers de formatação do painel Super Admin (pt-BR).
 * Sem dependências externas — só `Intl`/`Date`.
 */

/** Formata um valor (number ou string numérica) como moeda BRL. */
export function brl(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0);
  return (Number.isFinite(n) ? Number(n) : 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Data curta (dd/mm/aaaa) ou '—'. */
export function data(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

/** Data + hora (dd/mm/aaaa HH:mm) ou '—'. */
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export const PLANO_LABEL: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

export interface BadgeStatus {
  label: string;
  classe: string;
}

/**
 * Rótulo + classes Tailwind para o status do tenant.
 * Pares light/dark explícitos (exceção documentada da identidade):
 * verde=ativo, amarelo=em teste/pendente, vermelho=suspenso/inadimplente,
 * cinza=cancelado/desconhecido.
 */
export function statusTenant(status: string): BadgeStatus {
  switch (status) {
    case 'ATIVO':
      return {
        label: 'Ativo',
        classe: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400',
      };
    case 'TRIAL':
      return {
        label: 'Em teste',
        classe: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      };
    case 'SUSPENSO':
      return {
        label: 'Suspenso',
        classe: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
      };
    case 'INADIMPLENTE':
      return {
        label: 'Inadimplente',
        classe: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
      };
    case 'CANCELADO':
      return {
        label: 'Cancelado',
        classe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
    default:
      return {
        label: status,
        classe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
  }
}

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  EDITOR_CAMPANHA: 'Editor de campanha',
  VISUALIZADOR: 'Visualizador',
};
