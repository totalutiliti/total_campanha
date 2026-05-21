import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const HoraRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const JanelaEnvioSchema = z.object({
  inicio: z.string().regex(HoraRegex, 'Hora no formato HH:MM'),
  fim: z.string().regex(HoraRegex, 'Hora no formato HH:MM'),
  diasSemana: z.array(z.number().int().min(0).max(6)).min(1),
});

export const CriarCampanhaSchema = z.object({
  nome: z.string().min(1).max(160),
  segmentoId: z.string().uuid(),
  templateId: z.string().uuid(),
  canal: z.enum(['EMAIL', 'WHATSAPP']),
  agendadoPara: z.coerce.date().optional(),
  janelaEnvio: JanelaEnvioSchema.optional(),
});

export class CriarCampanhaDto extends createZodDto(CriarCampanhaSchema) {}
