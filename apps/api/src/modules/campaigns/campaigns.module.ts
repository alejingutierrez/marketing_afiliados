import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard';

import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  providers: [CampaignsService, RolesGuard],
  controllers: [CampaignsController]
})
export class CampaignsModule {}
