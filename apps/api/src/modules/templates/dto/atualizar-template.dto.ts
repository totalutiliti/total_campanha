import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const VariavelSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  exemplo: z.string().max(200),
});

export const AtualizarTemplateSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  // Email
  assunto: z.string().min(1).max(200).optional(),
  mjml: z.string().min(10).max(200_000).optional(),
  // WhatsApp
  metaTemplateName: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
  metaLanguage: z.string().min(2).max(10).optional(),
  // Comum
  variaveis: z.array(VariavelSchema).max(40).optional(),
});

export class AtualizarTemplateDto extends createZodDto(AtualizarTemplateSchema) {}
