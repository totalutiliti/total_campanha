import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  SESv2Client,
} from '@aws-sdk/client-sesv2';

import { env } from '../../config/config.module.js';

export interface RegistroDns {
  tipo: 'CNAME' | 'TXT' | 'MX';
  nome: string;
  valor: string;
  descricao: string;
}

export interface ResultadoCriarIdentidade {
  identidade: string;
  status: 'pendente' | 'verificada';
  dkimStatus: string;
  spfStatus: string;
  registrosDns: RegistroDns[];
}

export interface ResultadoVerificacao {
  identidade: string;
  status: 'pendente' | 'verificada' | 'falha';
  dkimStatus: string;
}

/**
 * Cliente SESv2 para gerenciar identidades de email (domínios) com DKIM.
 *
 * Em DEV sem credenciais AWS, cai para um **modo stub**: cria/verifica
 * em memória do banco, retorna CNAMEs fake. Suficiente para o user clicar
 * pelos passos do wizard sem precisar de conta AWS local.
 *
 * Em PROD/staging, AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY são obrigatórios.
 */
@Injectable()
export class SesIdentityClient {
  private readonly logger = new Logger(SesIdentityClient.name);
  private readonly client: SESv2Client | null;
  private readonly region: string;
  private readonly configSet?: string;

  /**
   * `true` quando o client está em modo stub (sem credenciais AWS).
   * Service consulta isso para devolver mensagens claras ao usuário em DEV.
   */
  readonly modoStub: boolean;

  constructor(config: ConfigService) {
    this.region = env(config, 'AWS_REGION');
    this.configSet = env(config, 'SES_CONFIGURATION_SET') ?? undefined;
    const accessKey = env(config, 'AWS_ACCESS_KEY_ID');
    const secretKey = env(config, 'AWS_SECRET_ACCESS_KEY');

    if (accessKey && secretKey) {
      this.client = new SESv2Client({
        region: this.region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      });
      this.modoStub = false;
    } else {
      this.client = null;
      this.modoStub = true;
      this.logger.warn(
        'AWS_ACCESS_KEY_ID/SECRET ausentes — SES em modo STUB. Não vai contatar AWS real.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------
  async criarIdentidadeDominio(
    dominio: string,
    remetente: string,
  ): Promise<ResultadoCriarIdentidade> {
    if (this.modoStub || !this.client) {
      return this.stubCriar(dominio, remetente);
    }
    const cmd = new CreateEmailIdentityCommand({
      EmailIdentity: dominio,
      DkimSigningAttributes: { NextSigningKeyLength: 'RSA_2048_BIT' },
      ...(this.configSet ? { ConfigurationSetName: this.configSet } : {}),
    });
    const resp = await this.client.send(cmd);

    // Tokens DKIM → 3 CNAMEs.
    const tokens = resp.DkimAttributes?.Tokens ?? [];
    const cnames: RegistroDns[] = tokens.map((t) => ({
      tipo: 'CNAME' as const,
      nome: `${t}._domainkey.${dominio}`,
      valor: `${t}.dkim.amazonses.com`,
      descricao: 'Assinatura DKIM (SES)',
    }));

    const registros: RegistroDns[] = [
      ...cnames,
      {
        tipo: 'TXT',
        nome: dominio,
        valor: 'v=spf1 include:amazonses.com -all',
        descricao: 'SPF — autoriza Amazon SES a enviar em nome do domínio',
      },
      {
        tipo: 'TXT',
        nome: `_dmarc.${dominio}`,
        valor: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + dominio,
        descricao: 'DMARC sugerido (quarantine) — proteção contra spoofing',
      },
    ];

    return {
      identidade: dominio,
      status: resp.VerifiedForSendingStatus ? 'verificada' : 'pendente',
      dkimStatus: resp.DkimAttributes?.Status ?? 'NOT_STARTED',
      spfStatus: 'pending',
      registrosDns: registros,
    };
  }

  // -------------------------------------------------------------------------
  // VERIFY
  // -------------------------------------------------------------------------
  async verificarIdentidade(dominio: string): Promise<ResultadoVerificacao> {
    if (this.modoStub || !this.client) {
      return { identidade: dominio, status: 'pendente', dkimStatus: 'PENDING' };
    }
    const resp = await this.client.send(
      new GetEmailIdentityCommand({ EmailIdentity: dominio }),
    );
    const dkimStatus = resp.DkimAttributes?.Status ?? 'NOT_STARTED';
    const verificada = !!resp.VerifiedForSendingStatus && dkimStatus === 'SUCCESS';
    return {
      identidade: dominio,
      status: verificada ? 'verificada' : dkimStatus === 'FAILED' ? 'falha' : 'pendente',
      dkimStatus,
    };
  }

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------
  async excluirIdentidade(dominio: string): Promise<void> {
    if (this.modoStub || !this.client) return;
    try {
      await this.client.send(new DeleteEmailIdentityCommand({ EmailIdentity: dominio }));
    } catch (err) {
      this.logger.warn({ msg: 'ses_delete_falhou', dominio, err });
    }
  }

  // -------------------------------------------------------------------------
  // Stub (DEV)
  // -------------------------------------------------------------------------
  private stubCriar(dominio: string, remetente: string): ResultadoCriarIdentidade {
    this.logger.debug({ msg: 'ses_stub_criar', dominio, remetente });
    const fakeTokens = ['stub1abcdef', 'stub2abcdef', 'stub3abcdef'];
    return {
      identidade: dominio,
      status: 'pendente',
      dkimStatus: 'STUB',
      spfStatus: 'pending',
      registrosDns: [
        ...fakeTokens.map((t) => ({
          tipo: 'CNAME' as const,
          nome: `${t}._domainkey.${dominio}`,
          valor: `${t}.dkim.amazonses.com`,
          descricao: '[STUB DEV] CNAME DKIM — sem AWS configurada',
        })),
        {
          tipo: 'TXT',
          nome: dominio,
          valor: 'v=spf1 include:amazonses.com -all',
          descricao: '[STUB DEV] SPF sugerido',
        },
        {
          tipo: 'TXT',
          nome: `_dmarc.${dominio}`,
          valor: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${dominio}`,
          descricao: '[STUB DEV] DMARC sugerido',
        },
      ],
    };
  }
}
