import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PlanoSchema = z.object({
  plano: z.enum(['STARTER', 'PRO', 'ENTERPRISE']),
});

export class PlanoDto extends createZodDto(PlanoSchema) {}
