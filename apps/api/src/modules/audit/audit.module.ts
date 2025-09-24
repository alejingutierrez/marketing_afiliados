import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard';

import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService, RolesGuard]
})
export class AuditModule {}
