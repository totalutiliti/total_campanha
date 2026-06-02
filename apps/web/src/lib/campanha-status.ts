export type StatusCampanha =
  | 'RASCUNHO'
  | 'AGENDADA'
  | 'DISPARANDO'
  | 'PAUSADA'
  | 'FINALIZADA'
  | 'CANCELADA';

/** Rótulo amigável + classes de cor para o status de uma campanha. */
export function statusCampanha(s: string): { label: string; classe: string } {
  switch (s) {
    case 'RASCUNHO':
      return { label: 'Rascunho', classe: 'bg-gray-100 text-gray-700' };
    case 'AGENDADA':
      return { label: 'Agendada', classe: 'bg-blue-100 text-blue-800' };
    case 'DISPARANDO':
      return { label: 'Enviando', classe: 'bg-amber-100 text-amber-800' };
    case 'PAUSADA':
      return { label: 'Pausada', classe: 'bg-amber-100 text-amber-800' };
    case 'FINALIZADA':
      return { label: 'Concluída', classe: 'bg-green-100 text-green-800' };
    case 'CANCELADA':
      return { label: 'Cancelada', classe: 'bg-red-100 text-red-700' };
    default:
      return { label: s, classe: 'bg-gray-100 text-gray-700' };
  }
}

export function canalLabel(canal: string): string {
  return canal === 'EMAIL' ? 'E-mail' : 'WhatsApp';
}
