import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CriarContatoSchema = z
  .object({
    nome: z.string().min(1).max(200).optional(),
    email: z.string().email().trim().toLowerCase().optional(),
    telefoneE164: z
      .string()
      .regex(/^\+\d{10,15}$/, 'Telefone deve estar em formato E.164 (+5511999999999)')
      .optional(),
    tags: z.array(z.string().min(1).max(60)).default([]),
    extras: z.record(z.unknown()).default({}),
  })
  .refine((data) => data.email || data.telefoneE164, {
    message: 'É obrigatório informar email ou telefone',
    path: ['email'],
  });

export class CriarContatoDto extends createZodDto(CriarContatoSchema) {}
