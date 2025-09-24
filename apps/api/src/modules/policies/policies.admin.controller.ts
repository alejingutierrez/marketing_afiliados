import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { POLICY_TYPES, type PolicyType } from '../../common/interfaces/policy.interface';
import { AppRole } from '../../common/interfaces/roles.enum';
import type { AuthenticatedUserPayload } from '../../common/interfaces/user.interface';
import { validateDto } from '../../common/utils/validate-dto';

import { PublishPolicyVersionDto } from './dto/publish-policy-version.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PoliciesService } from './policies.service';

@ApiTags('policies')
@ApiBearerAuth()
@Controller('policies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PoliciesAdminController {
  private parsePolicyType(value: string): PolicyType {
    const normalized = value.toLowerCase();
    if ((POLICY_TYPES as readonly string[]).includes(normalized)) {
      return normalized as PolicyType;
    }
    throw new BadRequestException(`Tipo de política no soportado: ${value}`);
  }

  constructor(private readonly policiesService: PoliciesService) {}

  @Get('consents/:influencerId')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.GESTOR_AFILIADOS, AppRole.AUDITOR)
  listConsents(@Param('influencerId') influencerId: string) {
    return this.policiesService.listInfluencerConsents(influencerId);
  }

  @Get('consents/:influencerId/:policyVersionId/certificate')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.GESTOR_AFILIADOS, AppRole.AUDITOR)
  getCertificate(
    @Param('influencerId') influencerId: string,
    @Param('policyVersionId') policyVersionId: string
  ) {
    return this.policiesService.generateConsentCertificate(influencerId, policyVersionId);
  }

  @Post(':policyType/versions')
  @Roles(AppRole.ADMIN_DENTSU)
  @HttpCode(HttpStatus.CREATED)
  publishPolicyVersion(
    @Param('policyType') policyTypeParam: string,
    @Body() payload: unknown,
    @CurrentUser() user: AuthenticatedUserPayload
  ) {
    const dto = validateDto(PublishPolicyVersionDto, payload);
    const policyType = this.parsePolicyType(policyTypeParam);
    return this.policiesService.publishPolicyVersion(policyType, dto, user.email);
  }
}
