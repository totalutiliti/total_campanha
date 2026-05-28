/**
 * Normalização de telefone para E.164, leve e sem dependências (o pacote
 * @total-campanha/shared não é transpilado pelo Next). Foco em Brasil: assume
 * DDI 55 quando o número vem sem código de país. O backend revalida no formato
 * estrito (+\d{10,15}) ao salvar, então casos exóticos são barrados lá com
 * mensagem clara.
 *
 * Exemplos:
 *   "(11) 98765-4321"   -> "+5511987654321"
 *   "11 91234 5678"     -> "+5511912345678"
 *   "+55 11 6792-3762"  -> "+551167923762"
 *   "+1 415 555 2671"   -> "+14155552671"
 *   "abc"               -> null
 */
export function paraE164(raw: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;

  const temPais = t.startsWith('+');
  const digitos = t.replace(/\D/g, '').replace(/^0+/, '');
  if (!digitos) return null;

  // Já veio com "+" e código de país — só validar o comprimento.
  if (temPais) {
    return digitos.length >= 10 && digitos.length <= 15 ? `+${digitos}` : null;
  }

  // BR já com DDI 55 (55 + DDD + 8/9 dígitos = 12 ou 13).
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    return `+${digitos}`;
  }

  // BR sem DDI: DDD (2) + número (8 ou 9) = 10 ou 11 dígitos.
  if (digitos.length === 10 || digitos.length === 11) {
    return `+55${digitos}`;
  }

  // Outros países digitados sem "+", mas com comprimento plausível.
  if (digitos.length >= 12 && digitos.length <= 15) {
    return `+${digitos}`;
  }

  return null;
}
