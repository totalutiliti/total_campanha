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
 * Provider atual: SMTP (DEV via MailHog em localhost:1025).
 *
 * Em PROD, MAIL_PROVIDER=ses ativa o transporter AWS SES (entra na Fase 4.2
 * junto com a verificação DKIM de domínio do tenant). Por enquanto SMTP cobre
 * dev + smoke tests.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromDefault: string;

  constructor(config: ConfigService) {
    const provider = env(config, 'MAIL_PROVIDER');
    this.fromDefault = env(config, 'MAIL_FROM_DEFAULT');

    if (provider === 'smtp') {
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
    } else {
      // SES/Resend entram na Fase 4.2.
      this.logger.warn(`Provider ${provider} ainda não implementado — caindo para SMTP.`);
      this.transporter = nodemailer.createTransport({
        host: env(config, 'SMTP_HOST'),
        port: env(config, 'SMTP_PORT'),
        secure: env(config, 'SMTP_SECURE'),
      });
    }
  }

  async enviar(msg: MailMessage): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
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
    this.transporter.close();
  }
}
