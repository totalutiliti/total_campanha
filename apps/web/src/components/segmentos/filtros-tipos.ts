/**
 * Tipos espelhando o schema do backend
 * (apps/api/src/modules/segmentos/filtros/filtros-schema.ts).
 *
 * Quando o backend mudar de operadores, ajustar aqui também. Em um próximo
 * refactor, mover o schema para `packages/shared` para eliminar essa duplicação.
 */

export const Operadores = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'in',
  'not_in',
  'has_opt_in_email',
  'has_opt_in_whatsapp',
] as const;
export type Operador = (typeof Operadores)[number];

/** Rótulos em português para exibição (o valor enviado ao backend é a chave). */
export const OperadorLabels: Record<Operador, string> = {
  equals: 'é igual a',
  not_equals: 'é diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  gt: 'maior que',
  lt: 'menor que',
  gte: 'maior ou igual a',
  lte: 'menor ou igual a',
  in: 'está na lista',
  not_in: 'não está na lista',
  has_opt_in_email: 'tem opt-in de e-mail',
  has_opt_in_whatsapp: 'tem opt-in de WhatsApp',
};

export const CamposPermitidos = [
  'nome',
  'email',
  'telefoneE164',
  'tags',
  'optInEmail',
  'optInWhatsapp',
  'createdAt',
  'updatedAt',
] as const;
export type CampoPermitido = (typeof CamposPermitidos)[number];

export interface Condicao {
  campo: string;
  operador: Operador;
  valor?: string | number | boolean | Array<string | number | boolean>;
}

export interface Grupo {
  modo: 'and' | 'or';
  condicoes: Array<Grupo | Condicao>;
}

export function ehGrupo(n: Grupo | Condicao): n is Grupo {
  return (n as Grupo).modo !== undefined;
}

export const grupoVazio: Grupo = { modo: 'and', condicoes: [] };
