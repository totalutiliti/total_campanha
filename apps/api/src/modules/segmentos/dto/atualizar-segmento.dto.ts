import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { GrupoSchema } from '../filtros/filtros-schema.js';

export const AtualizarSegmentoSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  filtros: GrupoSchema.optional(),
});

export class AtualizarSegmentoDto extends createZodDto(AtualizarSegmentoSchema) {}
