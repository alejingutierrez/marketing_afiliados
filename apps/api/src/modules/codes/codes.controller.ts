import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppRole } from '../../common/interfaces/roles.enum';
import { validateDto } from '../../common/utils/validate-dto';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CodesService } from './codes.service';
import { GenerateCodeDto } from './dto/generate-code.dto';

@ApiTags('codes')
@ApiBearerAuth()
@Controller('codes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN_DENTSU, AppRole.ADMIN_MARCA, AppRole.GESTOR_AFILIADOS)
export class CodesController {
  constructor(private readonly codesService: CodesService) {}

  @Get()
  list() {
    return this.codesService.list();
  }

  @Post()
  async generate(@Body() payload: unknown) {
    const dto = validateDto(GenerateCodeDto, payload);
    return this.codesService.generate(dto);
  }

  @Post(':id/sync')
  async sync(@Param('id') id: string) {
    return this.codesService.sync(id);
  }
}
