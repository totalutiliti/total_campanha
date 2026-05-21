import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { JanelaEnvioSchema } from './criar-campanha.dto.js';

/**
 * Só campanhas em RASCUNHO podem ser editadas (validado no service).
 */
export const AtualizarCampanhaSchema = z.object({
  nome: z.string().min(1).max(160).optional(),
  segmentoId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  agendadoPara: z.coerce.date().nullable().optional(),
  janelaEnvio: JanelaEnvioSchema.nullable().optional(),
});

export class AtualizarCampanhaDto extends createZodDto(AtualizarCampanhaSchema) {}
