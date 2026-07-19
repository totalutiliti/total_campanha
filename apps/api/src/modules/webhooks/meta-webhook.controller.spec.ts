import * as crypto from 'node:crypto';

import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { assinaturaHmacValida } from './meta-webhook-signature.js';
import { MetaWebhookController } from './meta-webhook.controller.js';

jest.mock('../../config/config.module.js', () => ({ env: jest.fn() }));

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

  test('responde HTTP 200 aos eventos da Meta', () => {
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, MetaWebhookController.prototype.receber),
    ).toBe(HttpStatus.OK);
  });
});
