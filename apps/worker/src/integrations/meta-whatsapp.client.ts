import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MetaErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number };
}

export class MetaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: MetaErrorBody,
  ) {
    super(`Meta API ${status}: ${body?.error?.message ?? 'erro'}`);
    this.name = 'MetaApiError';
  }

  /** Código de erro Meta (quando presente). */
  get codigo(): number | undefined {
    return this.body?.error?.code;
  }

  /**
   * Heurística para o RetryProcessor: 5xx e rate-limit (#80007, #131056,
   * #130429) são transientes; o resto é permanente.
   */
  get retryable(): boolean {
    if (this.status >= 500) return true;
    const cod = this.codigo;
    return cod === 80007 || cod === 131056 || cod === 130429 || cod === 4;
  }
}

interface SendResult {
  messages: Array<{ id: string }>;
}

/**
 * Cliente Meta para o worker — só envio (sendTemplate). Espelha o da API.
 */
@Injectable()
export class MetaWhatsappClient {
  private readonly logger = new Logger(MetaWhatsappClient.name);
  private readonly baseUrl: string;
  private readonly version: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('META_GRAPH_BASE_URL') ?? 'https://graph.facebook.com';
    this.version = config.get<string>('META_GRAPH_VERSION') ?? 'v22.0';
  }

  async sendTemplate(input: {
    token: string;
    phoneNumberId: string;
    to: string;
    templateName: string;
    language: string;
    variables?: string[];
  }): Promise<SendResult> {
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

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.to.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.language },
          ...(components ? { components } : {}),
        },
      }),
    });

    if (!r.ok) {
      let body: MetaErrorBody = {};
      try {
        body = (await r.json()) as MetaErrorBody;
      } catch {
        /* body não-JSON */
      }
      throw new MetaApiError(r.status, body);
    }
    return (await r.json()) as SendResult;
  }
}
