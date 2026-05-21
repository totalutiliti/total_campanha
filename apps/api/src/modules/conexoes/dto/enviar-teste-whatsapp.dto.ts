import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const EnviarTesteWhatsappSchema = z.object({
  telefoneE164: z.string().regex(/^\+\d{10,15}$/, 'Telefone em E.164 (+5511999999999)'),
});

export class EnviarTesteWhatsappDto extends createZodDto(EnviarTesteWhatsappSchema) {}
