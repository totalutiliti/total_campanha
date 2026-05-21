import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@total-campanha/db';

import { Condicao, ehGrupo, Grupo } from './filtros-schema.js';

/**
 * Traduz a árvore recursiva de filtros para um `Prisma.ContatoWhereInput`.
 *
 * Garantias:
 *   - Sempre adiciona `excluidoEm: null` no nível raiz (descarta soft-deleted).
 *   - Campos com prefixo `extras.` viram path em JSONB usando `Prisma.JsonObject`.
 *   - Validações de domínio fora do Zod: campo desconhecido lança BadRequest.
 *
 * **Não confia no input cego.** Mesmo após Zod, faz allow-list de campos para
 * impedir que um usuário aponte para `passwordHash` ou similar acidentalmente.
 */
const CAMPOS_PERMITIDOS = new Set([
  'nome',
  'email',
  'telefoneE164',
  'tags',
  'optInEmail',
  'optInWhatsapp',
  'createdAt',
  'updatedAt',
]);

export function traduzirFiltrosParaWhere(raiz: Grupo): Prisma.ContatoWhereInput {
  return {
    excluidoEm: null,
    ...traduzirGrupo(raiz),
  };
}

function traduzirGrupo(grupo: Grupo): Prisma.ContatoWhereInput {
  const partes = grupo.condicoes.map((n) => (ehGrupo(n) ? traduzirGrupo(n) : traduzirCondicao(n)));
  return grupo.modo === 'and' ? { AND: partes } : { OR: partes };
}

function traduzirCondicao(c: Condicao): Prisma.ContatoWhereInput {
  // Booleanos especiais.
  if (c.operador === 'has_opt_in_email') return { optInEmail: true };
  if (c.operador === 'has_opt_in_whatsapp') return { optInWhatsapp: true };

  // Campo em extras (JSONB).
  if (c.campo.startsWith('extras.')) {
    const path = c.campo.slice('extras.'.length).split('.');
    return traduzirCondicaoExtras(path, c);
  }

  if (!CAMPOS_PERMITIDOS.has(c.campo)) {
    throw new BadRequestException(`Campo não permitido em filtro: ${c.campo}`);
  }

  // Caso especial: `tags` é array de strings — `contains` significa "tem essa tag".
  if (c.campo === 'tags') {
    return traduzirCondicaoTags(c);
  }

  return traduzirCondicaoSimples(c);
}

function traduzirCondicaoSimples(c: Condicao): Prisma.ContatoWhereInput {
  const valor = c.valor;
  const campo = c.campo as keyof Prisma.ContatoWhereInput;
  switch (c.operador) {
    case 'equals':
      return { [campo]: { equals: valor as never } };
    case 'not_equals':
      return { [campo]: { not: { equals: valor as never } } };
    case 'contains':
      return { [campo]: { contains: String(valor ?? ''), mode: 'insensitive' } };
    case 'not_contains':
      return { [campo]: { not: { contains: String(valor ?? ''), mode: 'insensitive' } } };
    case 'gt':
      return { [campo]: { gt: valor as never } };
    case 'gte':
      return { [campo]: { gte: valor as never } };
    case 'lt':
      return { [campo]: { lt: valor as never } };
    case 'lte':
      return { [campo]: { lte: valor as never } };
    case 'in':
      return { [campo]: { in: arrayDe(valor) as never } };
    case 'not_in':
      return { [campo]: { notIn: arrayDe(valor) as never } };
    default:
      throw new BadRequestException(`Operador inválido para campo ${c.campo}: ${c.operador}`);
  }
}

function traduzirCondicaoTags(c: Condicao): Prisma.ContatoWhereInput {
  const v = c.valor;
  switch (c.operador) {
    case 'contains':
    case 'equals':
      return { tags: { has: String(v ?? '') } };
    case 'not_contains':
    case 'not_equals':
      return { NOT: { tags: { has: String(v ?? '') } } };
    case 'in':
      return { tags: { hasSome: arrayDe(v).map(String) } };
    case 'not_in':
      return { NOT: { tags: { hasSome: arrayDe(v).map(String) } } };
    default:
      throw new BadRequestException(`Operador inválido para tags: ${c.operador}`);
  }
}

function traduzirCondicaoExtras(path: string[], c: Condicao): Prisma.ContatoWhereInput {
  if (path.length === 0) {
    throw new BadRequestException('Path em extras vazio');
  }
  const equals = (valor: unknown): Prisma.ContatoWhereInput => ({
    extras: { path, equals: valor as Prisma.InputJsonValue },
  });
  switch (c.operador) {
    case 'equals':
      return equals(c.valor);
    case 'not_equals':
      return { NOT: equals(c.valor) };
    case 'contains':
      return {
        extras: {
          path,
          string_contains: String(c.valor ?? ''),
        },
      };
    case 'not_contains':
      return {
        NOT: {
          extras: { path, string_contains: String(c.valor ?? '') },
        },
      };
    case 'gt':
      return { extras: { path, gt: c.valor as never } };
    case 'gte':
      return { extras: { path, gte: c.valor as never } };
    case 'lt':
      return { extras: { path, lt: c.valor as never } };
    case 'lte':
      return { extras: { path, lte: c.valor as never } };
    default:
      throw new BadRequestException(`Operador inválido para extras.${path.join('.')}: ${c.operador}`);
  }
}

function arrayDe(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return [];
  return [v];
}
