import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { validateDto } from '../../common/utils/validate-dto';

/* eslint-disable @typescript-eslint/consistent-type-imports */
import { CreateWithdrawalRequestDto } from './dto/create-withdrawal-request.dto';
import { DecideWithdrawalDto } from './dto/decide-withdrawal.dto';
import { ListAdjustmentsQueryDto } from './dto/list-adjustments-query.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { AddDocumentDto, RecordPaymentDto } from './dto/record-payment.dto';
import { ResolveAdjustmentDto } from './dto/resolve-adjustment.dto';
import { PaymentsService } from './payments.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

type RequestWithUser = Request & { user: AuthenticatedUserPayload };

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('policies')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE, AppRole.ADMIN_MARCA)
  listPolicies() {
    return this.paymentsService.listPolicies();
  }

  @Get('withdrawals')
  @Roles(
    AppRole.ADMIN_DENTSU,
    AppRole.FINANCE,
    AppRole.ADMIN_MARCA,
    AppRole.GESTOR_AFILIADOS,
    AppRole.INFLUENCER
  )
  listWithdrawals(@Query() query: ListWithdrawalsQueryDto, @Req() req: RequestWithUser) {
    const dto = validateDto(ListWithdrawalsQueryDto, query ?? {});
    return this.paymentsService.listWithdrawals({ filter: dto, requester: req.user });
  }

  @Post('withdrawals')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE, AppRole.INFLUENCER)
  createWithdrawal(@Body() body: CreateWithdrawalRequestDto, @Req() req: RequestWithUser) {
    const dto = validateDto(CreateWithdrawalRequestDto, body ?? {});
    return this.paymentsService.createWithdrawal(dto, req.user);
  }

  @Patch('withdrawals/:id/decision')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  decideWithdrawal(
    @Param('id') id: string,
    @Body() body: DecideWithdrawalDto,
    @Req() req: RequestWithUser
  ) {
    const dto = validateDto(DecideWithdrawalDto, body ?? {});
    return this.paymentsService.decideWithdrawal(id, dto, req.user);
  }

  @Post('withdrawals/:id/pay')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  recordPayment(
    @Param('id') id: string,
    @Body() body: RecordPaymentDto,
    @Req() req: RequestWithUser
  ) {
    const dto = validateDto(RecordPaymentDto, body ?? {});
    return this.paymentsService.recordPayment(id, dto, req.user);
  }

  @Post('withdrawals/:id/documents')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE, AppRole.INFLUENCER)
  addDocumentToWithdrawal(
    @Param('id') id: string,
    @Body() body: AddDocumentDto,
    @Req() req: RequestWithUser
  ) {
    const dto = validateDto(AddDocumentDto, body ?? {});
    return this.paymentsService.attachDocumentToWithdrawal(id, dto, req.user);
  }

  @Post(':id/documents')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  addDocumentToPayment(
    @Param('id') id: string,
    @Body() body: AddDocumentDto,
    @Req() req: RequestWithUser
  ) {
    const dto = validateDto(AddDocumentDto, body ?? {});
    return this.paymentsService.attachDocumentToPayment(id, dto, req.user);
  }

  @Get('adjustments')
  @Roles(
    AppRole.ADMIN_DENTSU,
    AppRole.FINANCE,
    AppRole.ADMIN_MARCA,
    AppRole.GESTOR_AFILIADOS,
    AppRole.INFLUENCER
  )
  listAdjustments(@Query() query: ListAdjustmentsQueryDto, @Req() req: RequestWithUser) {
    const dto = validateDto(ListAdjustmentsQueryDto, query ?? {});
    return this.paymentsService.listAdjustments({ filter: dto, requester: req.user });
  }

  @Patch('adjustments/:id/resolve')
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  resolveAdjustment(
    @Param('id') id: string,
    @Body() body: ResolveAdjustmentDto,
    @Req() req: RequestWithUser
  ) {
    const dto = validateDto(ResolveAdjustmentDto, body ?? {});
    return this.paymentsService.resolveAdjustment(id, dto, req.user);
  }

  @Get()
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE, AppRole.INFLUENCER)
  listPayments(@Query() query: ListPaymentsQueryDto, @Req() req: RequestWithUser) {
    const dto = validateDto(ListPaymentsQueryDto, query ?? {});
    return this.paymentsService.listPayments({ filter: dto, requester: req.user });
  }
}
