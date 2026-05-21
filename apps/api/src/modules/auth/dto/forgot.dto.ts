import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ForgotSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
});

export class ForgotDto extends createZodDto(ForgotSchema) {}
