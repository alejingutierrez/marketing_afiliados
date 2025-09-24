import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { trace } from '@opentelemetry/api';
import { LoggerModule } from 'nestjs-pino';

import { validationSchema } from './common/utils/config.validation';
import configuration from './common/utils/configuration';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CodesModule } from './modules/codes/codes.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { InfluencersModule } from './modules/influencers/influencers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { VtexModule } from './modules/vtex/vtex.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        'apps/api/.env.local',
        '.env.shared',
        process.env.NODE_ENV === 'test' ? '.env.test' : undefined
      ].filter(Boolean) as string[],
      load: [configuration],
      validationSchema
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  translateTime: 'HH:MM:ss Z'
                }
              }
            : undefined,
        customProps: () => {
          const span = trace.getActiveSpan();
          if (!span) {
            return {};
          }
          const spanContext = span.spanContext();
          return {
            traceId: spanContext.traceId,
            spanId: spanContext.spanId
          };
        }
      }
    }),
    ObservabilityModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100
      }
    ]),
    TerminusModule,
    DatabaseModule,
    AuthModule,
    InfluencersModule,
    CampaignsModule,
    CodesModule,
    OrdersModule,
    CommissionsModule,
    PaymentsModule,
    PoliciesModule,
    NotificationsModule,
    DashboardModule,
    VtexModule,
    AuditModule,
    HealthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
