/**
 * Cria (ou promove) um usuário Super Admin — `isSuperAdmin = true`.
 *
 * Super Admin é conta operacional cross-tenant (RULES 1.6): NÃO é criada pelo
 * seed nem por endpoint. Este script é o caminho controlado e auditável para
 * isso — substitui o "via SQL manual" mencionado no BOOTSTRAP 6.1.
 *
 * Uso:
 *   SA_EMAIL=joao@totalutiliti.com.br SA_PASSWORD='...' \
 *     pnpm --filter @total-campanha/db criar-super-admin
 *
 * Requer AUTH_PEPPER no ambiente (mesmo do app — o hash precisa bater).
 * O hashing é idêntico ao PasswordService/EmailHashService da API:
 *   emailHash    = sha256(email_lowercased + pepper)
 *   passwordHash = argon2id(senha + pepper, t=3, m=64MiB, p=4)
 */
import * as crypto from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.SA_EMAIL ?? '').trim().toLowerCase();
  const senha = process.env.SA_PASSWORD ?? '';
  const pepper = process.env.AUTH_PEPPER ?? '';

  if (!email || !senha) {
    throw new Error('SA_EMAIL e SA_PASSWORD são obrigatórios.');
  }
  if (pepper.length < 32) {
    throw new Error('AUTH_PEPPER ausente ou com menos de 32 caracteres.');
  }

  const emailHash = crypto.createHash('sha256').update(`${email}${pepper}`).digest('hex');
  const passwordHash = await argon2.hash(`${senha}${pepper}`, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 64 * 1024,
    parallelism: 4,
  });

  const user = await prisma.user.upsert({
    where: { emailHash },
    update: { passwordHash, isSuperAdmin: true },
    create: { email, emailHash, passwordHash, isSuperAdmin: true },
  });

  console.log(`[super-admin] OK — ${email}`);
  console.log(`  userId: ${user.id}  isSuperAdmin: ${user.isSuperAdmin}`);
  console.log('  Login: POST /api/v1/admin/auth/login  (escopo /admin, cross-tenant)');
}

main()
  .catch((err) => {
    console.error('[super-admin] erro:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
