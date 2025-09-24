import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { OrderEventPayload } from '@vtex-client';
import type { Request } from 'express';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppRole } from '../../common/interfaces/roles.enum';
import { validateDto } from '../../common/utils/validate-dto';

import { OrderWebhookDto } from './dto/order-webhook.dto';
import { ReconciliationDto } from './dto/reconciliation.dto';
import { RunReconciliationDto } from './dto/run-reconciliation.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { VtexService } from './vtex.service';

type RawBodyRequest = Request & { rawBody?: string };

@ApiTags('vtex')
@Controller('vtex')
export class VtexController {
  constructor(private readonly vtexService: VtexService) {}

  @Post('codes/:id/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN_DENTSU, AppRole.ADMIN_MARCA, AppRole.GESTOR_AFILIADOS)
  @ApiBearerAuth()
  syncCoupon(@Param('id') id: string) {
    return this.vtexService.syncDiscountCode(id);
  }

  @Post('webhooks/orders')
  @Throttle({ default: { limit: 300, ttl: 60 } })
  async handleOrderWebhook(@Req() req: RawBodyRequest, @Body() payload: unknown) {
    const rawBody = req.rawBody ?? JSON.stringify(payload);
    const signature = this.vtexService.verifyWebhookSignature(req.headers, rawBody);

    if (!signature.valid) {
      throw new UnauthorizedException('Firma de VTEX invalida');
    }

    const normalized = this.vtexService.normalizeOrderPayload(payload);
    const dto = validateDto(OrderWebhookDto, payload);

    const sanitizedItems = dto.items.map((item, index) => {
      const normalizedItem = normalized.items[index] ?? {};
      return {
        ...normalizedItem,
        skuId: item.skuId,
        skuRef: item.skuRef ?? normalizedItem.skuRef,
        quantity: item.quantity,
        price: item.price,
        listPrice: item.listPrice ?? normalizedItem.listPrice,
        discount: item.discount ?? normalizedItem.discount,
        taxAmount: item.taxAmount ?? normalizedItem.taxAmount,
        categoryId: item.categoryId ?? normalizedItem.categoryId,
        categoryName: item.categoryName ?? normalizedItem.categoryName
      };
    });

    const event: OrderEventPayload = {
      ...normalized,
      orderId: dto.orderId,
      eventType: dto.eventType,
      status: dto.status,
      totalAmount: dto.totalAmount,
      currency: dto.currency,
      couponCode: dto.couponCode ?? normalized.couponCode,
      shippingAmount: dto.shippingAmount ?? normalized.shippingAmount,
      taxAmount: dto.taxAmount ?? normalized.taxAmount,
      eligibleAmount: dto.eligibleAmount ?? normalized.eligibleAmount,
      items: sanitizedItems,
      rawPayload: payload
    };

    return this.vtexService.handleOrderWebhook(event, {
      rawPayload: payload,
      signatureValid: signature.valid
    });
  }

  @Post('reconciliations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.FINANCE, AppRole.ADMIN_DENTSU)
  @ApiBearerAuth()
  recordReconciliation(@Body() payload: unknown) {
    const dto = validateDto(ReconciliationDto, payload);
    return this.vtexService.recordReconciliation(dto);
  }

  @Post('reconciliations/run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN_DENTSU, AppRole.FINANCE)
  @ApiBearerAuth()
  runReconciliation(@Req() req: Request, @Body() payload: unknown) {
    const dto = validateDto(RunReconciliationDto, payload ?? {});
    const date = dto.date ? new Date(dto.date) : new Date();
    const maybeUser = (req as unknown as { user?: { email?: string } }).user;
    const userEmail = typeof maybeUser?.email === 'string' ? maybeUser.email : undefined;

    return this.vtexService.runDailyReconciliation(date, {
      type: dto.type ?? 'daily',
      triggeredBy: userEmail
    });
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN_DENTSU, AppRole.ADMIN_MARCA, AppRole.GESTOR_AFILIADOS, AppRole.FINANCE)
  @ApiBearerAuth()
  listOrders() {
    return this.vtexService.listOrders();
  }
}
