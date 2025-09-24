import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

const METRICS_PREFIX = 'marketing_afiliados_worker_';

const register = new Registry();
collectDefaultMetrics({ register, prefix: METRICS_PREFIX });

const backupRunsCounter = new Counter({
  name: `${METRICS_PREFIX}backup_runs_total`,
  help: 'Cantidad de respaldos ejecutados con éxito',
  registers: [register]
});

const backupFailuresCounter = new Counter({
  name: `${METRICS_PREFIX}backup_failures_total`,
  help: 'Cantidad de respaldos que fallaron',
  registers: [register]
});

const backupDurationHistogram = new Histogram({
  name: `${METRICS_PREFIX}backup_duration_seconds`,
  help: 'Duración de los respaldos en segundos',
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

const backupLastSuccessGauge = new Gauge({
  name: `${METRICS_PREFIX}backup_last_success_timestamp_seconds`,
  help: 'Marca de tiempo del último respaldo exitoso',
  registers: [register]
});

export function recordBackupSuccess(durationMs: number) {
  backupRunsCounter.inc();
  backupDurationHistogram.observe(durationMs / 1000);
  backupLastSuccessGauge.set(Date.now() / 1000);
}

export function recordBackupFailure() {
  backupFailuresCounter.inc();
}

export function getMetricsRegistry(): Registry {
  return register;
}

export async function getMetricsSnapshot(): Promise<string> {
  return register.metrics();
}
