import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TotpVerifySchema = z.object({
  codigo: z.string().regex(/^\d{6}$/),
});

export class TotpVerifyDto extends createZodDto(TotpVerifySchema) {}
