import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service.js';

/**
 * Acesso a `users` e `user_tenants` (tabelas globais — sem RLS).
 *
 * Usado pelo AuthModule no signup/login. Implementação completa (convites,
 * convidar membro do tenant, listar) vem em Fase 1.3+.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorEmailHash(emailHash: string) {
    return this.prisma.user.findUnique({
      where: { emailHash },
      include: { userTenants: { include: { tenant: true } } },
    });
  }

  async buscarPorId(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { userTenants: { include: { tenant: true } } },
    });
  }
}
