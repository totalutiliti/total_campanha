import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AtualizarConexaoWhatsappSchema = z.object({
  // Apenas troca do token. wabaId/phoneNumberId trocar = delete + create.
  token: z.string().min(20),
  appSecret: z.string().min(16).max(200).optional(),
});

export class AtualizarConexaoWhatsappDto extends createZodDto(
  AtualizarConexaoWhatsappSchema,
) {}
