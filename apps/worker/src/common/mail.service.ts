import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  headers?: Record<string, string>;
}

/**
 * MailService do worker.
 *
 * - `MAIL_PROVIDER=smtp` (default): nodemailer — MailHog em dev, qualquer SMTP
 *   autenticado em staging (SMTP_USER/SMTP_PASS).
 * - `MAIL_PROVIDER=ses`: Amazon SES v2 (`SendEmail` com headers custom — usado
 *   para List-Unsubscribe). Exige AWS_ACCESS_KEY_ID/SECRET (validado no boot).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly provider: 'smtp' | 'ses';
  private readonly fromDefault: string;
  private readonly transporter: Transporter | null = null;
  private readonly ses: SESv2Client | null = null;
  private readonly sesConfigurationSet: string | undefined;

  constructor(config: ConfigService) {
    this.provider = (config.get<string>('MAIL_PROVIDER') as 'smtp' | 'ses') ?? 'smtp';
    this.fromDefault =
      config.get<string>('MAIL_FROM_DEFAULT') ?? 'Total Campanha <no-reply@totalcampanha.dev>';

    if (this.provider === 'ses') {
      this.ses = new SESv2Client({
        region: config.get<string>('AWS_REGION') ?? 'sa-east-1',
        credentials: {
          accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID') as string,
          secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY') as string,
        },
      });
      this.sesConfigurationSet = config.get<string>('SES_CONFIGURATION_SET') || undefined;
      this.logger.log('MailService em modo SES (envio real).');
    } else {
      const user = config.get<string>('SMTP_USER');
      this.transporter = nodemailer.createTransport({
        host: config.get<string>('SMTP_HOST') ?? 'localhost',
        port: Number(config.get<string>('SMTP_PORT') ?? 1025),
        secure: config.get<string>('SMTP_SECURE') === 'true',
        auth: user
          ? { user, pass: config.get<string>('SMTP_PASS') as string }
          : undefined,
      });
    }
  }

  async enviar(msg: MailMessage): Promise<{ messageId: string }> {
    if (this.provider === 'ses' && this.ses) {
      const out = await this.ses.send(
        new SendEmailCommand({
          FromEmailAddress: msg.from ?? this.fromDefault,
          Destination: { ToAddresses: [msg.to] },
          ConfigurationSetName: this.sesConfigurationSet,
          Content: {
            Simple: {
              Subject: { Data: msg.subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: msg.html, Charset: 'UTF-8' },
                ...(msg.text ? { Text: { Data: msg.text, Charset: 'UTF-8' } } : {}),
              },
              Headers: msg.headers
                ? Object.entries(msg.headers).map(([Name, Value]) => ({ Name, Value }))
                : undefined,
            },
          },
        }),
      );
      return { messageId: out.MessageId ?? 'ses-sem-id' };
    }

    const info = await (this.transporter as Transporter).sendMail({
      from: msg.from ?? this.fromDefault,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: msg.headers,
    });
    return { messageId: String(info.messageId) };
  }
}
