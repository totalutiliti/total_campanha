import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

import { env } from '../../config/config.module.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  headers?: Record<string, string>;
}

/**
 * MailService — abstrai envio de emails transacionais (signup confirm, double
 * opt-in, reset de senha, notificação de inbox, etc).
 *
 * - `MAIL_PROVIDER=smtp` (default): nodemailer — MailHog em dev, SMTP
 *   autenticado quando SMTP_USER/SMTP_PASS presentes.
 * - `MAIL_PROVIDER=ses`: Amazon SES v2 (`SendEmail` com headers custom).
 *   Exige AWS_ACCESS_KEY_ID/SECRET (validação cruzada no env).
 * - `MAIL_PROVIDER=resend`: ainda não implementado — warning + fallback SMTP.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly fromDefault: string;
  private readonly transporter: Transporter | null = null;
  private readonly ses: SESv2Client | null = null;
  private readonly sesConfigurationSet: string | undefined;

  constructor(config: ConfigService) {
    const provider = env(config, 'MAIL_PROVIDER');
    this.fromDefault = env(config, 'MAIL_FROM_DEFAULT');

    if (provider === 'ses') {
      this.ses = new SESv2Client({
        region: env(config, 'AWS_REGION'),
        credentials: {
          accessKeyId: env(config, 'AWS_ACCESS_KEY_ID') as string,
          secretAccessKey: env(config, 'AWS_SECRET_ACCESS_KEY') as string,
        },
      });
      this.sesConfigurationSet = env(config, 'SES_CONFIGURATION_SET') || undefined;
      this.logger.log('MailService em modo SES (envio real).');
      return;
    }

    if (provider !== 'smtp') {
      this.logger.warn(`Provider ${provider} ainda não implementado — caindo para SMTP.`);
    }
    this.transporter = nodemailer.createTransport({
      host: env(config, 'SMTP_HOST'),
      port: env(config, 'SMTP_PORT'),
      secure: env(config, 'SMTP_SECURE'),
      auth: env(config, 'SMTP_USER')
        ? {
            user: env(config, 'SMTP_USER') as string,
            pass: env(config, 'SMTP_PASS') as string,
          }
        : undefined,
    });
  }

  async enviar(msg: MailMessage): Promise<{ messageId: string }> {
    if (this.ses) {
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

  async onModuleDestroy(): Promise<void> {
    this.transporter?.close();
  }
}
