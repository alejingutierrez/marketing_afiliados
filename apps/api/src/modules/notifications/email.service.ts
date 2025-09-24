import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { v4 as uuid } from 'uuid';

export type AlertRecipientGroup = 'global' | 'finance' | 'operations';

interface MailRecipientsConfig {
  global?: string[];
  finance?: string[];
  operations?: string[];
}

interface MailSmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

interface MailConfiguration {
  enabled?: boolean;
  transport?: string;
  from?: string;
  recipients?: MailRecipientsConfig;
  smtp?: MailSmtpConfig;
}

export interface SentEmailRecord {
  id: string;
  category: string;
  group: AlertRecipientGroup;
  subject: string;
  to: string[];
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
  delivered: boolean;
  messageId?: string;
  response?: string;
  error?: string;
  sentAt: Date;
}

interface SendAlertOptions {
  category: string;
  group: AlertRecipientGroup;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly enabled: boolean;
  private readonly mode: 'smtp' | 'memory';
  private readonly from: string;
  private readonly recipients: Record<AlertRecipientGroup, string[]>;
  private readonly outbox: SentEmailRecord[] = [];

  constructor(private readonly configService: ConfigService) {
    const mailConfig = (this.configService.get<MailConfiguration>('mail') ?? {}) as MailConfiguration;

    this.enabled = mailConfig.enabled !== false;
    this.mode = (mailConfig.transport === 'stream' || mailConfig.transport === 'memory') ? 'memory' : 'smtp';
    this.from = mailConfig.from?.trim() || 'alerts@marketing-afiliados.local';
    this.recipients = {
      global: this.parseRecipients(
        mailConfig.recipients?.global ?? this.configService.get<string>('MAIL_ALERT_GLOBAL')
      ) || ['ops-alerts@medipiel.co'],
      finance:
        this.parseRecipients(
          mailConfig.recipients?.finance ?? this.configService.get<string>('MAIL_ALERT_FINANCE')
        ) || [],
      operations:
        this.parseRecipients(
          mailConfig.recipients?.operations ?? this.configService.get<string>('MAIL_ALERT_OPERATIONS')
        ) || []
    } as Record<AlertRecipientGroup, string[]>;

    if (!this.recipients.operations.length) {
      this.recipients.operations = [...this.recipients.global];
    }
    if (!this.recipients.finance.length) {
      this.recipients.finance = [...this.recipients.global];
    }

    if (!this.enabled) {
      this.transporter = null;
      this.logger.warn('Servicio de correo deshabilitado por configuración');
      return;
    }

    if (this.mode === 'memory') {
      this.transporter = createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix'
      });
      this.logger.log('Servicio de correo en modo memory/stream (no se enviarán correos reales)');
      return;
    }

    const smtpConfig: MailSmtpConfig = mailConfig.smtp ?? {};
    const host = smtpConfig.host || process.env.MAIL_SMTP_HOST || 'mailhog';
    const port = smtpConfig.port || Number(process.env.MAIL_SMTP_PORT ?? '1025');
    const secure = smtpConfig.secure ?? process.env.MAIL_SMTP_SECURE === 'true';
    const user = smtpConfig.user || process.env.MAIL_SMTP_USER;
    const pass = smtpConfig.pass || process.env.MAIL_SMTP_PASS;

    this.transporter = createTransport({
      host,
      port,
      secure,
      auth: user
        ? {
            user,
            pass: pass ?? ''
          }
        : undefined
    });
  }

  getOutbox(): Array<Omit<SentEmailRecord, 'sentAt'> & { sentAt: string }> {
    return this.outbox.map((email) => ({
      ...email,
      sentAt: email.sentAt.toISOString()
    }));
  }

  async sendAlert(options: SendAlertOptions): Promise<void> {
    const recipients = this.getRecipients(options.group);

    const record: SentEmailRecord = {
      id: uuid(),
      category: options.category,
      group: options.group,
      subject: options.subject,
      to: recipients,
      text: options.text,
      html: options.html,
      metadata: options.metadata,
      delivered: false,
      sentAt: new Date()
    };

    if (!recipients.length) {
      record.error = 'Sin destinatarios configurados';
      this.logger.error(`No se enviará correo de alerta (${options.category}) porque no hay destinatarios configurados`);
      this.outbox.push(record);
      return;
    }

    if (!this.enabled || !this.transporter) {
      record.error = 'Servicio de correo deshabilitado';
      this.outbox.push(record);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: recipients,
        subject: options.subject,
        text: options.text,
        html: options.html ?? `<pre>${options.text}</pre>`
      });
      record.delivered = true;
      record.messageId = info.messageId;
      if (typeof info.response === 'string') {
        record.response = info.response;
      }
      this.logger.log(`Correo de alerta enviado (${options.category}) -> ${recipients.join(', ')}`);
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fallo envío de correo (${options.category}): ${record.error}`);
    } finally {
      this.outbox.push(record);
    }
  }

  private getRecipients(group: AlertRecipientGroup): string[] {
    const resolved = this.recipients[group]?.filter(Boolean) ?? [];
    if (resolved.length) {
      return resolved;
    }
    return this.recipients.global?.filter(Boolean) ?? [];
  }

  private parseRecipients(input?: string | string[] | null): string[] | undefined {
    if (!input) {
      return undefined;
    }
    const values = Array.isArray(input) ? input : input.split(',');
    const normalized = values
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    return normalized.length ? normalized : undefined;
  }
}
