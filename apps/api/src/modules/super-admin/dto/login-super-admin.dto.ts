import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSuperAdminSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  senha: z.string().min(1).max(128),
});

export class LoginSuperAdminDto extends createZodDto(LoginSuperAdminSchema) {}
