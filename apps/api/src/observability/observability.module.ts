import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { RequestMetricsInterceptor } from './request-metrics.interceptor';

@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor
    }
  ],
  exports: [MetricsService]
})
export class ObservabilityModule {}
