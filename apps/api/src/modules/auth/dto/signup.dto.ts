import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SignupSchema = z.object({
  // Tenant
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'slug deve ser kebab-case (a-z, 0-9, -)'),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos sem formatação'),
  razaoSocial: z.string().min(2).max(200),
  // Admin user
  nomeResponsavel: z.string().min(2).max(120),
  email: z.string().email().trim().toLowerCase(),
  senha: z.string().min(8).max(128),
  aceiteDpaVersao: z.string().min(1),
});

export class SignupDto extends createZodDto(SignupSchema) {}
