import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListarContatosSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
  busca: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(60).optional(),
  optInEmail: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  optInWhatsapp: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  incluirExcluidos: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .default(false),
});

export class ListarContatosDto extends createZodDto(ListarContatosSchema) {}
