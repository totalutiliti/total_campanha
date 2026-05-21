import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  senha: z.string().min(1).max(128),
  // Quando o user tem 2FA habilitado, segundo passo manda o código.
  totp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export class LoginDto extends createZodDto(LoginSchema) {}
