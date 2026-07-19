import { loadEnv } from './env.js';

const BASE = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://app_user:senha@localhost:5432/total_campanha',
  AUTH_PEPPER: 'p'.repeat(32),
  TOKEN_KMS_KEY: 'k'.repeat(32),
};

describe('worker env — separação de privilégios', () => {
  test('rejeita migration_user como conexão de runtime', () => {
    expect(() =>
      loadEnv({
        ...BASE,
        DATABASE_URL: 'postgresql://migration_user:senha@localhost:5432/total_campanha',
      }),
    ).toThrow('não pode usar migration_user');
  });

  test('exige conexão de controle separada em produção', () => {
    expect(() => loadEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(
      'DATABASE_MIGRATION_URL é obrigatória',
    );
  });

  test('aceita app_user no runtime e URL de controle separada em produção', () => {
    expect(
      loadEnv({
        ...BASE,
        NODE_ENV: 'production',
        DATABASE_MIGRATION_URL: 'postgresql://migration_user:senha@localhost:5432/total_campanha',
      }).DATABASE_URL,
    ).toContain('app_user');
  });
});
