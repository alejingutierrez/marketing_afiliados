import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppRole } from '../../common/interfaces/roles.enum';
import type { AuthenticatedUserPayload } from '../../common/interfaces/user.interface';
import { validateDto } from '../../common/utils/validate-dto';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CommissionsService } from './commissions.service';
import { EvaluateTiersDto } from './dto/evaluate-tiers.dto';
import { RunSettlementDto } from './dto/run-settlement.dto';
import { TierHistoryQueryDto } from './dto/tier-history-query.dto';

@ApiTags('commissions')
@ApiBearerAuth()
@Controller('commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN_DENTSU, AppRole.ADMIN_MARCA, AppRole.FINANCE)
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get('summary')
  summary() {
    return this.commissionsService.summary();
  }

  @Get()
  list() {
    return this.commissionsService.list();
  }

  @Get('reconciliations')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  reconciliations() {
    return this.commissionsService.reconciliations();
  }

  @Get('balances')
  @Roles(
    AppRole.ADMIN_DENTSU,
    AppRole.ADMIN_MARCA,
    AppRole.FINANCE,
    AppRole.GESTOR_AFILIADOS,
    AppRole.INFLUENCER
  )
  balances(@Query('influencerId') influencerId: string | undefined, @Req() req: Request) {
    const user = req.user as AuthenticatedUserPayload;
    const effectiveInfluencerId = user.roles.includes(AppRole.INFLUENCER)
      ? influencerId ?? user.sub
      : influencerId;

    return this.commissionsService.balances({ influencerId: effectiveInfluencerId });
  }

  @Get('audit')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE, AppRole.AUDITOR)
  auditTrail() {
    return this.commissionsService.auditTrail();
  }

  @Get('tiers/history')
  tierHistory(@Query() query: TierHistoryQueryDto) {
    const dto = validateDto(TierHistoryQueryDto, query);
    return this.commissionsService.tierHistory(dto);
  }

  @Post('tiers/evaluate')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  evaluateTiers(@Body() payload: EvaluateTiersDto) {
    const dto = validateDto(EvaluateTiersDto, payload ?? {});
    return this.commissionsService.evaluateTiers(dto);
  }

  @Post('settlements/run')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  runSettlement(@Body() payload: RunSettlementDto) {
    const dto = validateDto(RunSettlementDto, payload ?? {});
    return this.commissionsService.runSettlement(dto);
  }
}
