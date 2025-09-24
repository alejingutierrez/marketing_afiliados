import { Injectable, Logger } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MetricsService } from '../../observability/metrics.service';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { EmailService } from './email.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { NotificationsService } from './notifications.service';

interface WebhookFailureAlert {
  orderId: string;
  eventType: string;
  reason: string;
}

interface ReconciliationAlert {
  discrepancies: number;
  type: 'daily' | 'manual' | 'fortnightly';
  alerts: string[];
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly metrics: MetricsService,
    private readonly email: EmailService
  ) {}

  async notifyWebhookFailure(alert: WebhookFailureAlert): Promise<void> {
    this.logger.warn(`Webhook VTEX falló para orden ${alert.orderId}: ${alert.reason}`);
    this.metrics.incrementAlert('webhook_failure');
    this.notifications.emit({
      type: 'webhook.failure',
      recipient: 'global',
      payload: {
        orderId: alert.orderId,
        eventType: alert.eventType,
        reason: alert.reason
      }
    });

    const textBody = [
      'Se detectó un error al procesar un webhook VTEX.',
      `Orden: ${alert.orderId}`,
      `Evento: ${alert.eventType}`,
      `Motivo: ${alert.reason}`
    ].join('\n');

    await this.email.sendAlert({
      category: 'webhook.failure',
      group: 'operations',
      subject: `[Marketing Afiliados] Falla webhook ${alert.eventType}`,
      text: textBody,
      html: `<p>Se detectó un error al procesar un webhook VTEX.</p><ul><li><strong>Orden:</strong> ${alert.orderId}</li><li><strong>Evento:</strong> ${alert.eventType}</li><li><strong>Motivo:</strong> ${alert.reason}</li></ul>`,
      metadata: { ...alert }
    });
  }

  async notifyReconciliationAlert(alert: ReconciliationAlert): Promise<void> {
    this.logger.warn(
      `Conciliación ${alert.type} detectó ${alert.discrepancies} discrepancias (${alert.alerts.join(', ') || 'sin detalle'})`
    );
    this.metrics.incrementAlert('reconciliation');
    this.notifications.emit({
      type: 'reconciliation.alert',
      recipient: 'finance',
      payload: {
        discrepancies: alert.discrepancies,
        alerts: alert.alerts,
        type: alert.type
      }
    });

    const detailList = alert.alerts.length
      ? `<ul>${alert.alerts.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '<p>No se recibieron detalles adicionales.</p>';
    const textBody = [
      `Conciliación ${alert.type} con discrepancias: ${alert.discrepancies}`,
      ...alert.alerts.map((item) => `- ${item}`)
    ].join('\n');

    await this.email.sendAlert({
      category: 'reconciliation.alert',
      group: 'finance',
      subject: `[Marketing Afiliados] Conciliación ${alert.type} con ${alert.discrepancies} discrepancias`,
      text: textBody,
      html: `<p>La conciliación <strong>${alert.type}</strong> reportó <strong>${alert.discrepancies}</strong> discrepancias.</p>${detailList}`,
      metadata: { ...alert }
    });
  }

  async notifyDelayedJob(queue: string, details: Record<string, unknown>): Promise<void> {
    this.logger.warn(`Job atrasado detectado en cola ${queue}`);
    this.metrics.incrementAlert('delayed_job');
    this.notifications.emit({
      type: 'worker.delayed_job',
      recipient: 'global',
      payload: {
        queue,
        ...details
      }
    });

    const textBody = [
      `Se detectó un trabajo atrasado en la cola ${queue}.`,
      `Detalles: ${JSON.stringify(details)}`
    ].join('\n');

    await this.email.sendAlert({
      category: 'worker.delayed_job',
      group: 'operations',
      subject: `[Marketing Afiliados] Job atrasado en cola ${queue}`,
      text: textBody,
      html: `<p>Se detectó un trabajo atrasado en la cola <strong>${queue}</strong>.</p><pre>${JSON.stringify(details, null, 2)}</pre>`,
      metadata: { queue, ...details }
    });
  }
}
