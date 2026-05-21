import { SetMetadata } from '@nestjs/common';
import { Role } from '@total-campanha/shared';

export const ROLES_KEY = 'tc:roles';

/**
 * Marca um handler com os roles permitidos. Combinado com TenantRoleGuard.
 *
 *   @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
 *
 * Sem o decorator, o TenantRoleGuard nega (sem default permissivo — ver SKILL.md seção 3).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export { Role };
