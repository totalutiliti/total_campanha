import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CriarConexaoWhatsappSchema = z.object({
  wabaId: z
    .string()
    .min(8)
    .max(40)
    .regex(/^\d+$/, 'wabaId deve conter apenas dígitos'),
  phoneNumberId: z
    .string()
    .min(8)
    .max(40)
    .regex(/^\d+$/, 'phoneNumberId deve conter apenas dígitos'),
  token: z.string().min(20),
});

export class CriarConexaoWhatsappDto extends createZodDto(CriarConexaoWhatsappSchema) {}
