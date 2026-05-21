import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResponderSchema = z.object({
  conteudo: z.string().min(1).max(4000),
});

export class ResponderDto extends createZodDto(ResponderSchema) {}
