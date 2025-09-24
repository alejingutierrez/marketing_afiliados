import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppRole } from '../../common/interfaces/roles.enum';
import { validateDto } from '../../common/utils/validate-dto';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN_DENTSU, AppRole.ADMIN_MARCA, AppRole.GESTOR_AFILIADOS)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  list() {
    return this.campaignsService.list();
  }

  @Post()
  create(@Body() payload: unknown) {
    const dto = validateDto(CreateCampaignDto, payload);
    return this.campaignsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: unknown) {
    const dto = validateDto(UpdateCampaignDto, payload);
    return this.campaignsService.update(id, dto);
  }
}
