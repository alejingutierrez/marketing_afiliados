import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppRole } from '../../common/interfaces/roles.enum';
import type { AuthenticatedUserPayload } from '../../common/interfaces/user.interface';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DashboardService } from './dashboard.service';
import type {
  AdminDashboardPayload,
  FinanceDashboardPayload,
  GestorDashboardPayload,
  InfluencerDashboardPayload
} from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('influencer')
  @Roles(AppRole.INFLUENCER, AppRole.ADMIN_DENTSU, AppRole.GESTOR_AFILIADOS, AppRole.ADMIN_MARCA)
  getInfluencerDashboard(
    @Query('influencerId') influencerId: string | undefined,
    @Req() req: Request
  ): InfluencerDashboardPayload {
    const user = req.user as AuthenticatedUserPayload;
    const targetInfluencerId = user.roles.includes(AppRole.INFLUENCER)
      ? user.sub
      : influencerId;

    if (!targetInfluencerId) {
      throw new BadRequestException('Debe indicar un influencerId para consultar el panel');
    }

    return this.dashboardService.getInfluencerDashboard(targetInfluencerId);
  }

  @Get('gestor')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.GESTOR_AFILIADOS, AppRole.ADMIN_MARCA)
  getGestorDashboard(): GestorDashboardPayload {
    return this.dashboardService.getGestorDashboard();
  }

  @Get('finance')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  getFinanceDashboard(): FinanceDashboardPayload {
    return this.dashboardService.getFinanceDashboard();
  }

  @Get('admin')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.AUDITOR)
  getAdminDashboard(): AdminDashboardPayload {
    return this.dashboardService.getAdminDashboard();
  }
}
