import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResetSchema = z.object({
  token: z.string().min(32),
  novaSenha: z.string().min(8).max(128),
});

export class ResetDto extends createZodDto(ResetSchema) {}
