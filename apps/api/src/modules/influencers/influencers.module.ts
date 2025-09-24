import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard';
import { VtexModule } from '../vtex/vtex.module';

import { InfluencersController } from './influencers.controller';
import { InfluencersService } from './influencers.service';

@Module({
  imports: [VtexModule],
  providers: [InfluencersService, RolesGuard],
  controllers: [InfluencersController]
})
export class InfluencersModule {}
