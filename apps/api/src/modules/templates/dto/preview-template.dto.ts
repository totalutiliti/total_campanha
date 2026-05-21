import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PreviewTemplateSchema = z.object({
  variaveis: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export class PreviewTemplateDto extends createZodDto(PreviewTemplateSchema) {}
