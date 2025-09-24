import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RolesGuard } from '../../common/guards/roles.guard';
import { ObservabilityModule } from '../../observability/observability.module';

import { AlertingService } from './alerting.service';
import { EmailService } from './email.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [ConfigModule, ObservabilityModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AlertingService, EmailService, RolesGuard],
  exports: [NotificationsService, AlertingService, EmailService]
})
export class NotificationsModule {}
