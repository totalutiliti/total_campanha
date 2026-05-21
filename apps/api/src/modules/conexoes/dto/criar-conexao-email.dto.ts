import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CriarConexaoEmailSchema = z.object({
  dominio: z
    .string()
    .min(4)
    .max(120)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Domínio inválido (ex: campanhas.cardanstencar.com.br)')
    .transform((v) => v.toLowerCase()),
  remetente: z.string().email().trim().toLowerCase(),
});

export class CriarConexaoEmailDto extends createZodDto(CriarConexaoEmailSchema) {}
