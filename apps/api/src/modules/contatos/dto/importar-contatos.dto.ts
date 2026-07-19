import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ImportarContatosSchema = z.object({
  modo: z.enum(['upsert', 'ignorar']).default('upsert'),
});

export class ImportarContatosDto extends createZodDto(ImportarContatosSchema) {}
