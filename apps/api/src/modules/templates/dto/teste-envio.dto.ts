import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TesteEnvioSchema = z
  .object({
    destinatarioEmail: z.string().email().toLowerCase().optional(),
    destinatarioTelefoneE164: z
      .string()
      .regex(/^\+\d{10,15}$/)
      .optional(),
    variaveis: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  })
  .refine((d) => d.destinatarioEmail || d.destinatarioTelefoneE164, {
    message: 'Informe destinatário (email ou telefone) compatível com o canal do template',
  });

export class TesteEnvioDto extends createZodDto(TesteEnvioSchema) {}
