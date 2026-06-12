import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TrocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Informe a senha atual.'),
  novaSenha: z.string().min(8, 'A senha nova precisa de pelo menos 8 caracteres.').max(128),
});

export class TrocarSenhaDto extends createZodDto(TrocarSenhaSchema) {}
