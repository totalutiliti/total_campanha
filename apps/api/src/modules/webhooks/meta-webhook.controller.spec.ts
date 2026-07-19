import * as crypto from 'node:crypto';

import { assinaturaHmacValida } from './meta-webhook-signature.js';

describe('Meta webhook — X-Hub-Signature-256', () => {
  const raw = Buffer.from('{"object":"whatsapp_business_account"}');
  const secret = 'app-secret-do-tenant';

  test('aceita assinatura HMAC do corpo bruto', () => {
    const assinatura = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
    expect(assinaturaHmacValida(raw, assinatura, secret)).toBe(true);
  });

  test('rejeita assinatura ausente ou de payload adulterado', () => {
    const assinatura = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
    expect(assinaturaHmacValida(raw, undefined, secret)).toBe(false);
    expect(assinaturaHmacValida(Buffer.from('{}'), assinatura, secret)).toBe(false);
  });
});
