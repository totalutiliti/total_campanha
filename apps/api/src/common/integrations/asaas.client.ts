import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { env } from '../../config/config.module.js';

export interface AsaasAssinatura {
  id: string;
  status: string;
  valor: number;
  proximoVencimento: string | null;
  linkPagamento: string | null;
}

/**
 * Cliente Asaas (billing). Em DEV sem `ASAAS_API_KEY`, opera em **modo stub**:
 * retorna assinaturas fake — o fluxo de UI funciona localmente sem conta Asaas.
 *
 * Em PROD a chave é obrigatória (validar quando provisionar staging).
 */
@Injectable()
export class AsaasClient {
  private readonly logger = new Logger(AsaasClient.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  readonly modoStub: boolean;

  constructor(config: ConfigService) {
    this.apiKey = env(config, 'ASAAS_API_KEY');
    this.baseUrl = env(config, 'ASAAS_BASE_URL');
    this.modoStub = !this.apiKey;
    if (this.modoStub) {
      this.logger.warn('ASAAS_API_KEY ausente — billing em modo STUB.');
    }
  }

  async criarAssinatura(input: {
    nomeCliente: string;
    cpfCnpj: string;
    email: string;
    valorMensal: number;
    descricao: string;
  }): Promise<AsaasAssinatura> {
    if (this.modoStub) {
      return {
        id: `stub_sub_${Date.now()}`,
        status: 'PENDING',
        valor: input.valorMensal,
        proximoVencimento: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        linkPagamento: 'https://sandbox.asaas.com/stub-checkout',
      };
    }

    // 1) cria/garante o customer. 2) cria a subscription.
    const customer = await this.post<{ id: string }>('/customers', {
      name: input.nomeCliente,
      cpfCnpj: input.cpfCnpj,
      email: input.email,
    });
    const sub = await this.post<{
      id: string;
      status: string;
      value: number;
      nextDueDate: string;
    }>('/subscriptions', {
      customer: customer.id,
      billingType: 'UNDEFINED',
      cycle: 'MONTHLY',
      value: input.valorMensal,
      nextDueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      description: input.descricao,
    });
    return {
      id: sub.id,
      status: sub.status,
      valor: sub.value,
      proximoVencimento: sub.nextDueDate,
      // A subscription gera a 1ª cobrança em seguida; o link vem dela.
      linkPagamento: await this.linkPagamento(sub.id),
    };
  }

  /**
   * URL de pagamento da cobrança mais recente da subscription (invoiceUrl).
   * É o que o assinante abre para pagar — sem isso o ciclo não fecha.
   */
  async linkPagamento(subscriptionId: string): Promise<string | null> {
    if (this.modoStub) return 'https://sandbox.asaas.com/stub-checkout';
    try {
      const r = await this.request<{ data?: Array<{ invoiceUrl?: string; status?: string }> }>(
        'GET',
        `/subscriptions/${subscriptionId}/payments?limit=1`,
      );
      return r.data?.[0]?.invoiceUrl ?? null;
    } catch (err) {
      // A 1ª cobrança pode ainda não existir logo após criar a subscription.
      this.logger.warn({ msg: 'asaas_link_pagamento_indisponivel', subscriptionId, err });
      return null;
    }
  }

  async atualizarValor(subscriptionId: string, valorMensal: number): Promise<void> {
    if (this.modoStub) return;
    await this.post(`/subscriptions/${subscriptionId}`, { value: valorMensal });
  }

  async cancelar(subscriptionId: string): Promise<void> {
    if (this.modoStub) return;
    await this.request('DELETE', `/subscriptions/${subscriptionId}`);
  }

  // ---------------------------------------------------------------------------
  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        access_token: this.apiKey as string,
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Asaas ${method} ${path} → ${r.status}: ${txt.slice(0, 200)}`);
    }
    return (await r.json()) as T;
  }
}
