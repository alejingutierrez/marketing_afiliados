import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

export const SWAGGER_ROUTE = 'api/docs';

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Marketing Afiliados API')
    .setDescription(
      'Endpoints del programa de marketing de afiliados Medipiel. Incluye flujos de autenticación, influencers, campañas, VTEX, comisiones, pagos, dashboard y observabilidad.'
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addTag('auth')
    .addTag('health')
    .addTag('policies')
    .addTag('influencers')
    .addTag('campaigns')
    .addTag('codes')
    .addTag('orders')
    .addTag('commissions')
    .addTag('payments')
    .addTag('notifications')
    .addTag('dashboard')
    .addTag('audit')
    .addTag('vtex')
    .build();

  return SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: false
  });
}

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup(SWAGGER_ROUTE, app, document, {
    customSiteTitle: 'Marketing Afiliados – API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true
    }
  });

  return document;
}
