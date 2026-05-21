import type { TierMeta } from '@total-campanha/shared';

/**
 * Throttling de disparo (RULES 7.1).
 *
 * Mensagens marketing/min por tier Meta — define o intervalo entre jobs
 * enfileirados. O dispatch computa o `delay` de cada job a partir disso.
 */
const MSGS_POR_MIN: Record<TierMeta, number> = {
  TIER_250: 10,
  TIER_1K: 40,
  TIER_10K: 400,
  TIER_100K: 4000,
  TIER_UNLIMITED: 10000,
};

/** Email não tem tier Meta — usamos uma taxa fixa conservadora. */
const EMAIL_MSGS_POR_MIN = 120;

export function intervaloMsWhatsapp(tier: TierMeta): number {
  return Math.ceil(60_000 / MSGS_POR_MIN[tier]);
}

export function intervaloMsEmail(): number {
  return Math.ceil(60_000 / EMAIL_MSGS_POR_MIN);
}

export interface JanelaEnvio {
  inicio: string; // 'HH:MM'
  fim: string; // 'HH:MM'
  diasSemana: number[]; // 0=domingo .. 6=sábado
}

/**
 * Ajusta um instante para cair dentro da janela de envio do tenant.
 *
 * - Se já está dentro da janela e num dia permitido, retorna como está.
 * - Caso contrário, avança para o próximo `inicio` de janela válido.
 *
 * Trabalha em horário local do servidor; o tenant opera UTC-3 (America/Sao_Paulo).
 * Em PROD o container roda com TZ=America/Sao_Paulo (env), então `getHours()`
 * reflete o horário do tenant.
 */
export function ajustarParaJanela(quando: Date, janela: JanelaEnvio | null): Date {
  if (!janela) return quando;

  const [hIni, mIni] = janela.inicio.split(':').map(Number);
  const [hFim, mFim] = janela.fim.split(':').map(Number);
  const minutosIni = hIni * 60 + mIni;
  const minutosFim = hFim * 60 + mFim;

  // Limite de segurança: no máximo 14 dias de avanço.
  const d = new Date(quando);
  for (let i = 0; i < 14 * 24 * 60; i += 1) {
    const minutosAtual = d.getHours() * 60 + d.getMinutes();
    const diaOk = janela.diasSemana.includes(d.getDay());
    if (diaOk && minutosAtual >= minutosIni && minutosAtual < minutosFim) {
      return d;
    }
    if (diaOk && minutosAtual < minutosIni) {
      // Mesmo dia, antes da janela → salta para o início.
      d.setHours(hIni, mIni, 0, 0);
      return d;
    }
    // Avança para o início da janela do próximo dia.
    d.setDate(d.getDate() + 1);
    d.setHours(hIni, mIni, 0, 0);
  }
  return d;
}
