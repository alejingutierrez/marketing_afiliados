import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppRole } from '../../common/interfaces/roles.enum';
import { validateDto } from '../../common/utils/validate-dto';

import { RegisterInfluencerDto } from './dto/register-influencer.dto';
import { UpdateInfluencerStatusDto } from './dto/update-influencer-status.dto';
import { UpdateInfluencerDto } from './dto/update-influencer.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InfluencersService } from './influencers.service';

@ApiTags('influencers')
@Controller()
export class InfluencersController {
  constructor(private readonly influencersService: InfluencersService) {}

  @Post('public/influencers')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  registerPublic(@Body() payload: unknown) {
    const dto = validateDto(RegisterInfluencerDto, payload);
    return this.influencersService.registerPublicInfluencer(dto);
  }

  @Get('influencers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN_DENTSU, AppRole.ADMIN_MARCA, AppRole.GESTOR_AFILIADOS)
  @ApiBearerAuth()
  list() {
    return this.influencersService.listInfluencers();
  }

  @Get('influencers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN_DENTSU, AppRole.ADMIN_MARCA, AppRole.GESTOR_AFILIADOS)
  @ApiBearerAuth()
  detail(@Param('id') id: string) {
    return this.influencersService.getInfluencer(id);
  }

  @Patch('influencers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN_DENTSU, AppRole.GESTOR_AFILIADOS)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() payload: unknown) {
    const dto = validateDto(UpdateInfluencerDto, payload);
    return this.influencersService.updateInfluencer(id, dto);
  }

  @Patch('influencers/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN_DENTSU, AppRole.GESTOR_AFILIADOS, AppRole.ADMIN_MARCA)
  @ApiBearerAuth()
  async updateStatus(@Param('id') id: string, @Body() payload: unknown) {
    const dto = validateDto(UpdateInfluencerStatusDto, payload);
    return this.influencersService.updateStatus(id, dto);
  }

  @Post('influencers/:id/campaigns/:campaignId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN_DENTSU, AppRole.GESTOR_AFILIADOS, AppRole.ADMIN_MARCA)
  assignCampaign(@Param('id') id: string, @Param('campaignId') campaignId: string) {
    return this.influencersService.assignToCampaign(id, campaignId);
  }
}
