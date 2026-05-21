import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { GrupoSchema } from '../filtros/filtros-schema.js';

/**
 * Body de POST /segmentos/previa — usado pelo FiltroBuilder no frontend
 * para retornar a contagem ao vivo enquanto o usuário monta filtros sem
 * precisar salvar.
 */
export const PreviaFiltrosSchema = z.object({
  filtros: GrupoSchema,
  canal: z.enum(['EMAIL', 'WHATSAPP']).optional(),
});

export class PreviaFiltrosDto extends createZodDto(PreviaFiltrosSchema) {}
