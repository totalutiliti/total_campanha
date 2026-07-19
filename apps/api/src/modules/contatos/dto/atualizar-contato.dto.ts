import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AtualizarContatoSchema = z.object({
  nome: z.string().min(1).max(200).optional(),
  email: z.string().email().trim().toLowerCase().optional().nullable(),
  telefoneE164: z
    .string()
    .regex(/^\+\d{10,15}$/, 'Telefone deve estar em formato E.164')
    .optional()
    .nullable(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  extras: z.record(z.unknown()).optional(),
  // O painel pode revogar, mas não fabricar prova de consentimento.
  optInEmail: z.literal(false).optional(),
  optInWhatsapp: z.literal(false).optional(),
});

export class AtualizarContatoDto extends createZodDto(AtualizarContatoSchema) {}
