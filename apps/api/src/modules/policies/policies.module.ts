import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { PoliciesAdminController } from './policies.admin.controller';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PoliciesController, PoliciesAdminController],
  providers: [PoliciesService]
})
export class PoliciesModule {}
