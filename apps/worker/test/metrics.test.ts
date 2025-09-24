import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  getMetricsRegistry,
  getMetricsSnapshot,
  recordBackupFailure,
  recordBackupSuccess
} from '../src/metrics';

test('records backup metrics for successful and failed snapshots', async () => {
  const registry = getMetricsRegistry();
  registry.resetMetrics();

  recordBackupSuccess(2_500);
  recordBackupFailure();

  const metricsJson = await registry.getMetricsAsJSON();
  const runMetric = metricsJson.find(
    (metric) => metric.name === 'marketing_afiliados_worker_backup_runs_total'
  );
  const failMetric = metricsJson.find(
    (metric) => metric.name === 'marketing_afiliados_worker_backup_failures_total'
  );
  const lastSuccessMetric = metricsJson.find(
    (metric) => metric.name === 'marketing_afiliados_worker_backup_last_success_timestamp_seconds'
  );

  const runValue = runMetric?.values?.[0]?.value ?? 0;
  const failValue = failMetric?.values?.[0]?.value ?? 0;
  const lastSuccessValue = lastSuccessMetric?.values?.[0]?.value ?? 0;

  assert.equal(runValue, 1, 'expected backup success counter to increment');
  assert.equal(failValue, 1, 'expected backup failure counter to increment');
  assert.ok(lastSuccessValue > 0, 'expected last success gauge to be set');

  const metrics = await getMetricsSnapshot();
  assert.match(
    metrics,
    /marketing_afiliados_worker_backup_duration_seconds_bucket\{.*\} [0-9.]+/,
    'expected duration histogram sample'
  );
});
