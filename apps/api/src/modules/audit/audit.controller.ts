import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppRole } from '../../common/interfaces/roles.enum';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN_DENTSU, AppRole.AUDITOR)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  list() {
    return this.auditService.logs();
  }
}
