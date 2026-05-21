import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { GrupoSchema } from '../filtros/filtros-schema.js';

export const CriarSegmentoSchema = z.object({
  nome: z.string().min(1).max(120),
  filtros: GrupoSchema,
});

export class CriarSegmentoDto extends createZodDto(CriarSegmentoSchema) {}
