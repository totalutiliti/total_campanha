import { z } from 'zod';

/**
 * Schema Zod dos filtros de segmento (BOOTSTRAP 3.1).
 *
 * Estrutura recursiva: cada nó é um grupo (com modo and/or e lista de condicoes)
 * ou uma condicao folha (campo + operador + valor).
 *
 * Operadores suportados (BOOTSTRAP 3.1):
 *   - equals, not_equals
 *   - contains, not_contains       (arrays e strings)
 *   - gt, lt, gte, lte             (datas e números)
 *   - in, not_in                   (array de valores)
 *   - has_opt_in_email, has_opt_in_whatsapp  (booleano implícito)
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

const ValorEscalar = z.union([z.string(), z.number(), z.boolean()]);
const Valor = z.union([ValorEscalar, z.array(ValorEscalar)]);

const Condicao = z.object({
  campo: z.string().min(1).max(120),
  operador: z.enum(Operadores),
  valor: Valor.optional(),
});
export type Condicao = z.infer<typeof Condicao>;

// Definição recursiva: Grupo pode conter Grupo ou Condicao.
export interface Grupo {
  modo: 'and' | 'or';
  condicoes: Array<Grupo | Condicao>;
}

export const GrupoSchema: z.ZodType<Grupo> = z.lazy(() =>
  z.object({
    modo: z.enum(['and', 'or']),
    condicoes: z.array(z.union([GrupoSchema, Condicao])).max(50),
  }),
);

export function ehGrupo(n: Grupo | Condicao): n is Grupo {
  return (n as Grupo).modo !== undefined;
}
