import http from 'node:http';
import type { AddressInfo } from 'node:net';

import pinoLogger from 'pino';

import { createBackupSnapshot } from './backup';
import { getMetricsSnapshot } from './metrics';
import { shutdownTelemetry, startTelemetry } from './telemetry';

const logger = pinoLogger({
  name: 'marketing-afiliados-worker'
});

const DEFAULT_METRICS_PORT = Number(process.env.WORKER_METRICS_PORT ?? '9465');
const METRICS_PATH = '/metrics';

function startMetricsServer(port: number) {
  const server = http.createServer(async (req, res) => {
    if (!req.url || req.method !== 'GET') {
      res.statusCode = 404;
      res.end();
      return;
    }

    if (!req.url.startsWith(METRICS_PATH)) {
      res.statusCode = 404;
      res.end();
      return;
    }

    try {
      const body = await getMetricsSnapshot();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.end(body);
    } catch (error) {
      logger.error({ err: error }, 'No fue posible generar métricas del worker');
      res.statusCode = 500;
      res.end('metrics_unavailable');
    }
  });

  server.listen(port, () => {
    const address = server.address() as AddressInfo | null;
    if (address) {
      logger.info({ port: address.port }, 'Servidor de métricas del worker iniciado');
    }
  });

  return server;
}

async function bootstrapWorker() {
  await startTelemetry({
    serviceName: 'marketing-afiliados-worker',
    environment: process.env.NODE_ENV,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  });

  const metricsPort = DEFAULT_METRICS_PORT;
  const metricsServer = startMetricsServer(metricsPort);

  const intervalMs = Number(process.env.BACKUP_INTERVAL_MS ?? 15 * 60 * 1000);
  logger.info({ intervalMs }, 'Programando respaldos periódicos');

  const executeBackup = async () => {
    try {
      const filePath = await createBackupSnapshot();
      logger.info({ filePath }, 'Respaldo generado correctamente');
    } catch (error) {
      logger.error({ err: error }, 'Fallo generación de respaldo');
    }
  };

  // Ejecutar respaldo inicial
  await executeBackup();
  const interval = setInterval(() => {
    void executeBackup();
  }, intervalMs);

  const handleShutdown = async (signal: string) => {
    logger.info({ signal }, 'Recibida señal de apagado, cerrando worker');
    clearInterval(interval);
    metricsServer.close();
    await shutdownTelemetry();
    process.exit(0);
  };

  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);
}

bootstrapWorker().catch(async (error) => {
  logger.error({ err: error }, 'Error fatal en el worker');
  await shutdownTelemetry();
  process.exit(1);
});
