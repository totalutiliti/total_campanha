import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { env } from '../../config/config.module.js';
import { CryptoService } from '../crypto/crypto.service.js';

export interface MetaPhoneNumberInfo {
  id: string;
  displayPhoneNumber: string;
  verifiedName?: string;
  qualityRating?: string;
}

export interface MetaSendResult {
  messages: Array<{ id: string }>;
  contacts?: Array<{ input: string; wa_id: string }>;
}

export interface MetaErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_user_msg?: string;
    fbtrace_id?: string;
  };
}

export class MetaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: MetaErrorBody,
  ) {
    super(`Meta API ${status}: ${body?.error?.message ?? 'erro desconhecido'}`);
    this.name = 'MetaApiError';
  }
}

/**
 * Cliente Meta Cloud API (Graph) — somente as chamadas que a plataforma faz
 * direto. Recebe `token` por chamada (jamais armazena) e logamos mascarado.
 *
 * Chamadas implementadas:
 *   - getPhoneNumber(token, phoneNumberId)
 *   - sendTemplate(token, phoneNumberId, ...)
 *
 * Cada método retorna `Promise<T>` em sucesso e lança `MetaApiError` em falha,
 * com o body original preservado (útil para mapear códigos 131xxx em UX e
 * para o RetryProcessor da Fase 5 decidir se vale tentar de novo).
 */
@Injectable()
export class MetaWhatsappClient {
  private readonly logger = new Logger(MetaWhatsappClient.name);
  private readonly baseUrl: string;
  private readonly version: string;

  constructor(
    config: ConfigService,
    private readonly crypto: CryptoService,
  ) {
    this.baseUrl = env(config, 'META_GRAPH_BASE_URL');
    this.version = env(config, 'META_GRAPH_VERSION');
  }

  // -------------------------------------------------------------------------
  // Phone number info — usado no onboarding (RULES 4.3).
  // -------------------------------------------------------------------------
  async getPhoneNumber(token: string, phoneNumberId: string): Promise<MetaPhoneNumberInfo> {
    const url = `${this.baseUrl}/${this.version}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`;
    const json = await this.fetchJson<{
      id: string;
      display_phone_number: string;
      verified_name?: string;
      quality_rating?: string;
    }>('GET', url, token);
    return {
      id: json.id,
      displayPhoneNumber: json.display_phone_number,
      verifiedName: json.verified_name,
      qualityRating: json.quality_rating,
    };
  }

  // -------------------------------------------------------------------------
  // Enviar template — base do dispatcher (Fase 5) e do "enviar-teste" (4.1).
  // -------------------------------------------------------------------------
  async sendTemplate(input: {
    token: string;
    phoneNumberId: string;
    to: string;
    templateName: string;
    language: string;
    variables?: string[]; // body params em ordem
  }): Promise<MetaSendResult> {
    const url = `${this.baseUrl}/${this.version}/${input.phoneNumberId}/messages`;

    const components =
      input.variables && input.variables.length > 0
        ? [
            {
              type: 'body',
              parameters: input.variables.map((v) => ({ type: 'text', text: v })),
            },
          ]
        : undefined;

    const body = {
      messaging_product: 'whatsapp',
      to: input.to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.language },
        ...(components ? { components } : {}),
      },
    };

    return this.fetchJson<MetaSendResult>('POST', url, input.token, body);
  }

  // -------------------------------------------------------------------------
  // Enviar texto livre — só permitido DENTRO da janela de 24h (Inbox, Fase 5.3).
  // -------------------------------------------------------------------------
  async sendText(input: {
    token: string;
    phoneNumberId: string;
    to: string;
    texto: string;
  }): Promise<MetaSendResult> {
    const url = `${this.baseUrl}/${this.version}/${input.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: input.to.replace(/^\+/, ''),
      type: 'text',
      text: { body: input.texto },
    };
    return this.fetchJson<MetaSendResult>('POST', url, input.token, body);
  }

  // -------------------------------------------------------------------------
  // Send "hello_world" — usado pelo endpoint enviar-teste (BOOTSTRAP 4.1).
  // -------------------------------------------------------------------------
  async sendHelloWorld(
    token: string,
    phoneNumberId: string,
    to: string,
  ): Promise<MetaSendResult> {
    return this.sendTemplate({
      token,
      phoneNumberId,
      to,
      templateName: 'hello_world',
      language: 'en_US',
    });
  }

  // -------------------------------------------------------------------------
  // Helpers privados
  // -------------------------------------------------------------------------
  private async fetchJson<T>(
    method: 'GET' | 'POST',
    url: string,
    token: string,
    body?: unknown,
  ): Promise<T> {
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    this.logger.debug({
      msg: 'meta_request',
      method,
      url,
      status: r.status,
      bearer: this.crypto.maskBearer(token),
    });

    if (!r.ok) {
      let errBody: MetaErrorBody = {};
      try {
        errBody = (await r.json()) as MetaErrorBody;
      } catch {
        // Body não é JSON — mantém vazio.
      }
      throw new MetaApiError(r.status, errBody);
    }
    return (await r.json()) as T;
  }
}
