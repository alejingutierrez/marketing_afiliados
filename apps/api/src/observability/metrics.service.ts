import { Injectable, Logger, Optional } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry
} from 'prom-client';

const METRICS_PREFIX = 'marketing_afiliados_';

function ensureCounter<T extends string>(
  register: Registry,
  configuration: { name: string; help: string; labelNames?: T[] }
): Counter<T> {
  const existing = register.getSingleMetric(configuration.name) as Counter<T> | undefined;
  if (existing) {
    return existing;
  }

  return new Counter({
    ...configuration,
    registers: [register]
  });
}

function ensureGauge<T extends string>(
  register: Registry,
  configuration: { name: string; help: string; labelNames?: T[] }
): Gauge<T> {
  const existing = register.getSingleMetric(configuration.name) as Gauge<T> | undefined;
  if (existing) {
    return existing;
  }

  return new Gauge({
    ...configuration,
    registers: [register]
  });
}

function ensureHistogram<T extends string>(
  register: Registry,
  configuration: { name: string; help: string; labelNames?: T[]; buckets?: number[] }
): Histogram<T> {
  const existing = register.getSingleMetric(configuration.name) as Histogram<T> | undefined;
  if (existing) {
    return existing;
  }

  return new Histogram({
    ...configuration,
    registers: [register]
  });
}

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly register = new Registry();
  private enabled = true;

  constructor(@Optional() private readonly configService?: ConfigService) {
    // defer reading configuration until onModuleInit so DI has settled and
    // avoid crashes if ConfigService isn't available in some DI scenarios
    // (e.g. during tests or circular module resolution)
  }

  private readonly httpRequestHistogram = ensureHistogram(this.register, {
    name: `${METRICS_PREFIX}api_request_duration_seconds`,
    help: 'Duración de peticiones HTTP atendidas por la API en segundos',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
  });

  private readonly webhookCounter = ensureCounter(this.register, {
    name: `${METRICS_PREFIX}webhook_events_total`,
    help: 'Total de webhooks VTEX procesados',
    labelNames: ['event_type', 'success']
  });

  private readonly webhookDurationHistogram = ensureHistogram(this.register, {
    name: `${METRICS_PREFIX}webhook_duration_seconds`,
    help: 'Duración del procesamiento de webhooks VTEX',
    labelNames: ['event_type', 'success'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
  });

  private readonly reconciliationGauge = ensureGauge(this.register, {
    name: `${METRICS_PREFIX}reconciliation_discrepancies_total`,
    help: 'Número de discrepancias detectadas por conciliación',
    labelNames: ['type']
  });

  private readonly queueGauge = ensureGauge(this.register, {
    name: `${METRICS_PREFIX}queue_pending_jobs`,
    help: 'Tamaño estimado de colas internas pendientes',
    labelNames: ['queue']
  });

  private readonly alertsCounter = ensureCounter(this.register, {
    name: `${METRICS_PREFIX}alerts_total`,
    help: 'Alertas operativas emitidas',
    labelNames: ['alert_type']
  });

  onModuleInit() {
    try {
      if (this.configService) {
        this.enabled = this.configService.get('metrics.enabled', true);
      }
    } catch (err) {
      this.logger.warn('No se pudo leer configuration de metrics, manteniendo enabled=true');
    }

    if (!this.enabled) {
      this.logger.warn('Colección de métricas deshabilitada por configuración');
      return;
    }

    collectDefaultMetrics({
      register: this.register,
      prefix: METRICS_PREFIX
    });
    this.logger.log('Colección de métricas Prometheus inicializada');
  }

  onModuleDestroy() {
    this.logger.log('Limpiando registro de métricas');
    this.register.clear();
  }

  observeHttpRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }) {
    if (!this.enabled) {
      return;
    }
    const seconds = input.durationMs / 1000;
    this.httpRequestHistogram
      .labels(input.method.toUpperCase(), input.route, String(input.statusCode))
      .observe(seconds);
  }

  observeWebhookProcessing(input: {
    eventType: string;
    success: boolean;
    durationMs: number;
  }) {
    if (!this.enabled) {
      return;
    }
    const labels = [input.eventType, input.success ? 'true' : 'false'] as const;
    this.webhookCounter.labels(...labels).inc();
    this.webhookDurationHistogram.labels(...labels).observe(input.durationMs / 1000);
  }

  recordReconciliationDiscrepancies(input: { type: 'daily' | 'manual' | 'fortnightly'; count: number }) {
    if (!this.enabled) {
      return;
    }
    this.reconciliationGauge.labels(input.type).set(input.count);
  }

  setQueueDepth(queue: string, depth: number) {
    if (!this.enabled) {
      return;
    }
    this.queueGauge.labels(queue).set(depth);
  }

  incrementAlert(alertType: string) {
    if (!this.enabled) {
      return;
    }
    this.alertsCounter.labels(alertType).inc();
  }

  async getMetricsSnapshot(): Promise<string> {
    if (!this.enabled) {
      return '# metrics disabled\n';
    }
    return this.register.metrics();
  }
}
