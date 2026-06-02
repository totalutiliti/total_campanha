import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Criação de tenant pelo Super Admin (provisionamento de cliente).
 * Espelha as regras do signup público, mas SEM senha (gerada temporária no
 * servidor) e sem aceite de DPA (o cliente aceita no primeiro acesso).
 */
export const CriarTenantSchema = z.object({
  razaoSocial: z.string().min(2).max(200),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos sem formatação'),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Identificador deve ser kebab-case (a-z, 0-9, -)'),
  emailAdmin: z.string().email().trim().toLowerCase(),
  plano: z.enum(['STARTER', 'PRO', 'ENTERPRISE']).optional(),
});

export class CriarTenantDto extends createZodDto(CriarTenantSchema) {}
