import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
  headers?: Record<string, string>;
}

/**
 * MailService do worker. Em DEV usa SMTP (MailHog). Em PROD, MAIL_PROVIDER=ses
 * faria o transporter SES — por ora SMTP cobre dev + smoke.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromDefault: string;

  constructor(config: ConfigService) {
    this.fromDefault =
      config.get<string>('MAIL_FROM_DEFAULT') ?? 'Total Campanha <no-reply@totalcampanha.dev>';
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST') ?? 'localhost',
      port: Number(config.get<string>('SMTP_PORT') ?? 1025),
      secure: config.get<string>('SMTP_SECURE') === 'true',
    });
  }

  async enviar(msg: MailMessage): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
      from: msg.from ?? this.fromDefault,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      headers: msg.headers,
    });
    return { messageId: String(info.messageId) };
  }
}
