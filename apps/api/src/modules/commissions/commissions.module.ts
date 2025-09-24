import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard';

import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';

@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService, RolesGuard]
})
export class CommissionsModule {}
