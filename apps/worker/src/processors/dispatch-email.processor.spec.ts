import { DispatchEmailProcessor } from './dispatch-email.processor.js';

describe('DispatchEmailProcessor — claim atômico', () => {
  test('jobs concorrentes enviam uma única vez e usam remetente do tenant', async () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const mensagemId = '22222222-2222-2222-2222-222222222222';
    const campanhaId = '33333333-3333-3333-3333-333333333333';
    let status = 'ENFILEIRADA';
    let dono: string | null = null;
    let usage = 0;

    const tx = {
      mensagem: {
        updateMany: jest.fn(async ({ where, data }) => {
          if (data.status === 'PROCESSANDO') {
            if (status !== 'ENFILEIRADA') return { count: 0 };
            status = 'PROCESSANDO';
            dono = data.processamentoToken;
            return { count: 1 };
          }
          if (
            data.status === 'ENVIADA' &&
            status === 'PROCESSANDO' &&
            where.processamentoToken === dono
          ) {
            status = 'ENVIADA';
            return { count: 1 };
          }
          return { count: 0 };
        }),
        findUnique: jest.fn(async () => ({
          id: mensagemId,
          contatoId: '44444444-4444-4444-4444-444444444444',
        })),
      },
      campanha: {
        findUnique: jest.fn(async () => ({
          id: campanhaId,
          status: 'DISPARANDO',
          templateId: '55555555-5555-5555-5555-555555555555',
        })),
        update: jest.fn(async () => ({})),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      template: {
        findUnique: jest.fn(async () => ({
          mjml: '<mjml><mj-body><mj-section><mj-column><mj-text>Olá {{nome}}</mj-text></mj-column></mj-section></mj-body></mjml>',
          assunto: 'Olá',
        })),
      },
      contato: {
        findUnique: jest.fn(async () => ({
          id: '44444444-4444-4444-4444-444444444444',
          nome: 'Cliente',
          email: 'cliente@example.com',
          telefoneE164: null,
          extras: {},
          optInEmail: true,
        })),
      },
      conexaoEmail: {
        findFirst: jest.fn(async () => ({ remetente: 'Campanhas <marketing@tenant.com.br>' })),
      },
      usageLog: {
        create: jest.fn(async () => {
          usage += 1;
          return {};
        }),
      },
    };
    const prisma = {
      tenant: { findUnique: jest.fn(async () => ({ status: 'ATIVO' })) },
      runInTenant: jest.fn(async (_tenantId, fn) => fn(tx)),
    };
    const mail = {
      enviar: jest.fn(async () => ({ messageId: 'ses-1' })),
    };
    const config = { get: jest.fn(() => 'http://localhost:3000/p/opt-out') };
    const optOut = { emitir: jest.fn(() => 'token-opt-out') };
    const processor = new DispatchEmailProcessor(
      config as never,
      prisma as never,
      mail as never,
      optOut as never,
    );
    const job = { data: { mensagemId, tenantId, campanhaId } } as never;

    await Promise.all([processor.process(job), processor.process(job)]);

    expect(mail.enviar).toHaveBeenCalledTimes(1);
    expect(mail.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Campanhas <marketing@tenant.com.br>' }),
    );
    expect(usage).toBe(1);
    expect(status).toBe('ENVIADA');
  });
});
