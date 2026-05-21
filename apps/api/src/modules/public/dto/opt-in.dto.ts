import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const OptInSchema = z
  .object({
    nome: z.string().min(1).max(200).optional(),
    email: z.string().email().trim().toLowerCase().optional(),
    telefoneE164: z
      .string()
      .regex(/^\+\d{10,15}$/, 'Telefone deve estar em formato E.164 (+5511999999999)')
      .optional(),
    canais: z
      .object({
        email: z.boolean().default(false),
        whatsapp: z.boolean().default(false),
      })
      .refine((c) => c.email || c.whatsapp, {
        message: 'Selecione ao menos um canal (email ou whatsapp).',
      }),
    origem: z.string().min(1).max(60).default('landing-tenant'),
    recaptchaToken: z.string().optional(),
  })
  .refine((data) => data.email || data.telefoneE164, {
    message: 'É obrigatório informar email ou telefone.',
    path: ['email'],
  })
  .refine((data) => !(data.canais.email && !data.email), {
    message: 'Para opt-in de email, informe o email.',
    path: ['email'],
  })
  .refine((data) => !(data.canais.whatsapp && !data.telefoneE164), {
    message: 'Para opt-in de WhatsApp, informe o telefone.',
    path: ['telefoneE164'],
  });

export class OptInDto extends createZodDto(OptInSchema) {}
