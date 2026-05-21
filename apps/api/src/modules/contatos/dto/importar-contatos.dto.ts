import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ImportarContatosSchema = z.object({
  modo: z.enum(['upsert', 'ignorar']).default('upsert'),
  optInEmail: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .default(false),
  optInWhatsapp: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .default(false),
});

export class ImportarContatosDto extends createZodDto(ImportarContatosSchema) {}
