import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard';
import { VtexModule } from '../vtex/vtex.module';

import { CodesController } from './codes.controller';
import { CodesService } from './codes.service';

@Module({
  imports: [VtexModule],
  providers: [CodesService, RolesGuard],
  controllers: [CodesController]
})
export class CodesModule {}
