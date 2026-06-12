export type StatusCampanha =
  | 'RASCUNHO'
  | 'AGENDADA'
  | 'DISPARANDO'
  | 'PAUSADA'
  | 'FINALIZADA'
  | 'CANCELADA';

/**
 * Rótulo amigável + classes de cor para o status de uma campanha.
 * Pares light/dark explícitos (exceção documentada da identidade — badges de
 * status usam cores literais, mas SEMPRE com o par `dark:`).
 */
export function statusCampanha(s: string): { label: string; classe: string } {
  switch (s) {
    case 'RASCUNHO':
      return {
        label: 'Rascunho',
        classe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
    case 'AGENDADA':
      return {
        label: 'Agendada',
        classe: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      };
    case 'DISPARANDO':
      return {
        label: 'Enviando',
        classe: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      };
    case 'PAUSADA':
      return {
        label: 'Pausada',
        classe: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      };
    case 'FINALIZADA':
      return {
        label: 'Concluída',
        classe: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      };
    case 'CANCELADA':
      return {
        label: 'Cancelada',
        classe: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      };
    default:
      return {
        label: s,
        classe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
  }
}

export function canalLabel(canal: string): string {
  return canal === 'EMAIL' ? 'E-mail' : 'WhatsApp';
}
