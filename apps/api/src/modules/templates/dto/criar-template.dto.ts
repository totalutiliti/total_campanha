import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const VariavelSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'chave deve ser identificador (a-zA-Z0-9_)'),
  exemplo: z.string().max(200),
});

/**
 * Schema único (objeto) — createZodDto não aceita discriminatedUnion (gera
 * tipo união e a classe não compila). Validação condicional por canal via
 * superRefine.
 */
export const CriarTemplateSchema = z
  .object({
    canal: z.enum(['EMAIL', 'WHATSAPP']),
    nome: z.string().min(1).max(120),
    // Email
    assunto: z.string().min(1).max(200).optional(),
    mjml: z.string().min(10).max(200_000).optional(),
    // WhatsApp
    metaTemplateName: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9_]+$/, 'metaTemplateName deve ser snake_case ASCII')
      .optional(),
    metaLanguage: z.string().min(2).max(10).default('pt_BR'),
    variaveis: z.array(VariavelSchema).max(40).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.canal === 'EMAIL') {
      if (!data.assunto) {
        ctx.addIssue({ code: 'custom', path: ['assunto'], message: 'Obrigatório para EMAIL' });
      }
      if (!data.mjml) {
        ctx.addIssue({ code: 'custom', path: ['mjml'], message: 'Obrigatório para EMAIL' });
      }
    } else if (data.canal === 'WHATSAPP') {
      if (!data.metaTemplateName) {
        ctx.addIssue({
          code: 'custom',
          path: ['metaTemplateName'],
          message: 'Obrigatório para WHATSAPP',
        });
      }
    }
  });

export class CriarTemplateDto extends createZodDto(CriarTemplateSchema) {}
