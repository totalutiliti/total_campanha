import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normaliza um telefone para E.164 (`+5511999999999`). Padrão Brasil quando o
 * número vier sem código de país (RULES 8.7).
 *
 * Retorna `null` se o número for inválido.
 */
export function normalizarTelefoneE164(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const limpo = raw.trim();
  if (!limpo) return null;
  const parsed = parsePhoneNumberFromString(limpo, 'BR');
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/**
 * Hash one-way irreversível para destinatário anonimizado (RULES 5.3).
 * Sha256 do telefone E.164 ou email lowercased. Não usar para login.
 */
export function destinatarioHash(canal: 'EMAIL' | 'WHATSAPP', valor: string): string {
  // Implementação real fica no API/Worker (precisa do pepper). Esta função
  // existe só para padronizar o formato esperado. Não exporta crypto aqui
  // porque o pacote `@total-campanha/shared` é consumido pelo Next.js também
  // (browser bundle não precisa de node:crypto carregado em vão).
  throw new Error(
    `destinatarioHash deve ser implementado no consumidor com pepper. canal=${canal} valor=${valor.length}`,
  );
}
