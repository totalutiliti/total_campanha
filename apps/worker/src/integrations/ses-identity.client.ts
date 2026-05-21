import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetEmailIdentityCommand,
  SESv2Client,
} from '@aws-sdk/client-sesv2';

/**
 * Versão simplificada do SesIdentityClient da API — só verificação.
 * O job recorrente do worker só precisa do GetEmailIdentity.
 *
 * Em modo stub (sem credenciais AWS): retorna sempre `pendente`.
 */
@Injectable()
export class WorkerSesIdentityClient {
  private readonly logger = new Logger(WorkerSesIdentityClient.name);
  private readonly client: SESv2Client | null;
  readonly modoStub: boolean;

  constructor(config: ConfigService) {
    const accessKey = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = config.get<string>('AWS_REGION') ?? 'sa-east-1';

    if (accessKey && secretKey) {
      this.client = new SESv2Client({
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      });
      this.modoStub = false;
    } else {
      this.client = null;
      this.modoStub = true;
      this.logger.warn('SES em modo STUB no worker (sem AWS creds).');
    }
  }

  async verificar(dominio: string): Promise<{
    status: 'verificada' | 'pendente' | 'falha';
    dkimStatus: string;
  }> {
    if (this.modoStub || !this.client) {
      return { status: 'pendente', dkimStatus: 'STUB' };
    }
    const resp = await this.client.send(
      new GetEmailIdentityCommand({ EmailIdentity: dominio }),
    );
    const dkimStatus = resp.DkimAttributes?.Status ?? 'NOT_STARTED';
    const verificada = !!resp.VerifiedForSendingStatus && dkimStatus === 'SUCCESS';
    return {
      status: verificada ? 'verificada' : dkimStatus === 'FAILED' ? 'falha' : 'pendente',
      dkimStatus,
    };
  }
}
