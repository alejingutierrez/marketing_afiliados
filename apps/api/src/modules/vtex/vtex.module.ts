import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VtexClient } from '@vtex-client';

// eslint-disable-next-line import/order
import { ObservabilityModule } from '../../observability/observability.module';

// eslint-disable-next-line import/order
import { NotificationsModule } from '../notifications/notifications.module';
import { VTEX_CLIENT } from './vtex.constants';
import { VtexController } from './vtex.controller';
import { VtexService } from './vtex.service';

@Module({
  imports: [ConfigModule, ObservabilityModule, NotificationsModule],
  controllers: [VtexController],
  providers: [
    {
      provide: VTEX_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const vtexConfig = configService.get('vtex') ?? {};
        return new VtexClient({
          account: vtexConfig.account ?? '',
          environment: vtexConfig.environment ?? 'production',
          appKey: vtexConfig.appKey ?? '',
          appToken: vtexConfig.appToken ?? '',
          baseUrl: vtexConfig.baseUrl,
          timeoutMs: vtexConfig.timeoutMs,
          maxRetries: vtexConfig.maxRetries,
          retryDelayMs: vtexConfig.retryDelayMs,
          webhookSecret: vtexConfig.webhookSecret,
          defaultCurrency: vtexConfig.defaultCurrency,
          credentials: vtexConfig.credentials
        });
      }
    },
    VtexService
  ],
  exports: [VtexService]
})
export class VtexModule {}
