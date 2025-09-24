import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { json } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { setupSwagger } from './observability/swagger';
import { shutdownTelemetry, startTelemetry } from './observability/telemetry';

async function bootstrap() {
  await startTelemetry({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'marketing-afiliados-api',
    environment: process.env.NODE_ENV,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  });
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);

  app.use(
    json({
      verify: (req: Record<string, unknown>, _res, buffer) => {
        req.rawBody = buffer.toString();
      }
    })
  );

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' }
    })
  );
  app.enableCors({
    origin: configService.get('corsOrigins'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
  });
  app.setGlobalPrefix('api/v1');

  setupSwagger(app);

  const port = configService.get<number>('port', 3001);
  await app.listen(port);
  logger.log(`API listening on port ${port}`);

  const teardown = async () => {
    await shutdownTelemetry();
    await app.close();
    process.exit(0);
  };

  process.once('SIGTERM', teardown);
  process.once('SIGINT', teardown);
}

bootstrap();
