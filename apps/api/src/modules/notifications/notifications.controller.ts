import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppRole } from '../../common/interfaces/roles.enum';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { EmailService } from './email.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN_DENTSU, AppRole.GESTOR_AFILIADOS)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService
  ) {}

  @Get('pending')
  pending() {
    return this.notificationsService.pending();
  }

  @Get('emails')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.AUDITOR)
  emails() {
    return this.emailService.getOutbox();
  }
}
