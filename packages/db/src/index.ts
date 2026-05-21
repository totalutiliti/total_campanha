// Re-exporta o client Prisma. Use isso ao invés de importar @prisma/client direto
// para garantir um único PrismaClient resolvido por todo o monorepo.
export { Prisma, PrismaClient } from '@prisma/client';
export type * from '@prisma/client';

export { RLS_TENANT_TABLES } from './rls-tables.js';
