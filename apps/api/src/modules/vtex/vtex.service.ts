import { Inject, Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import type {
  VtexClient,
  CouponResponse,
  DailyOrderSnapshot,
  OrderEventPayload,
  WebhookValidationResult
} from '@vtex-client';
import { v4 as uuid } from 'uuid';

import type { CampaignEntity } from '../../common/interfaces/campaign.interface';
import type { DiscountCodeEntity } from '../../common/interfaces/discount-code.interface';
import type {
  InfluencerEntity,
  InfluencerStatus
} from '../../common/interfaces/influencer.interface';
import type {
  CommissionRecord,
  OrderEntity,
  ReconciliationRecord
} from '../../common/interfaces/order.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InMemoryDatabaseService } from '../../database/database.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MetricsService } from '../../observability/metrics.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AlertingService } from '../notifications/alerting.service';

import type { ReconciliationDto } from './dto/reconciliation.dto';
import { VTEX_CLIENT } from './vtex.constants';

interface OrderProcessingOptions {
  rawPayload?: unknown;
  signatureValid: boolean;
  attempts?: number;
}

interface CouponSyncOptions {
  forceDeactivate?: boolean;
}

interface ReconciliationRunOptions {
  type?: 'daily' | 'fortnightly' | 'adhoc';
  triggeredBy?: string;
}

interface DiscrepancyReport {
  total: number;
  alerts: string[];
  details: Record<string, unknown>;
}

const AMOUNT_TOLERANCE = 0.01;

@Injectable()
export class VtexService {
  private readonly logger = new Logger(VtexService.name);

  private readonly includeShippingInEligible: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(VTEX_CLIENT)
    private readonly client: VtexClient,
    private readonly database: InMemoryDatabaseService,
    private readonly metrics: MetricsService,
    private readonly alerting: AlertingService
  ) {
    const vtexConfig = this.configService.get('vtex') ?? {};

    this.includeShippingInEligible = Boolean(vtexConfig.includeShippingInEligible);
  }

  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookValidationResult {
    return this.client.verifyWebhookSignature(headers, rawBody);
  }

  normalizeOrderPayload(payload: unknown): OrderEventPayload {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload VTEX invalido');
    }

    return this.client.mapOrderPayload(payload as Record<string, unknown>);
  }

  async syncDiscountCode(discountCodeId: string, options: CouponSyncOptions = {}): Promise<DiscountCodeEntity | undefined> {
    const discount = this.database.getDiscountCodeById(discountCodeId);
    if (!discount) {
      this.logger.warn(`Discount code ${discountCodeId} no encontrado`);
      return undefined;
    }

    const campaign = this.database.getCampaignById(discount.campaignId);
    const influencer = this.database.getInfluencerById(discount.influencerId);

    try {
      const coupon = await this.client.createOrUpdateCoupon({
        code: discount.code,
        discountPercent: discount.discountPercent,
        maxUsage: discount.maxUsage,
        startsAt: discount.startDate,
        expiresAt: discount.endDate,
        campaignId: discount.campaignId,
        influencerId: discount.influencerId,
        metadata: {
          tenantId: discount.tenantId,
          campaignName: campaign?.name,
          campaignStatus: campaign?.status,
          influencerName: influencer ? `${influencer.firstName} ${influencer.lastName}`.trim() : undefined,
          influencerStatus: influencer?.status
        }
      });

      const desiredActive = this.shouldActivateCoupon({ discount, influencer, campaign, options });
      const reconciledCoupon = desiredActive
        ? await this.ensureCouponActive(coupon)
        : await this.ensureCouponInactive(coupon);

      this.applyCouponResponse(discount.id, reconciledCoupon, desiredActive);
      return this.database.getDiscountCodeById(discount.id);
    } catch (error) {
      this.logger.error(`Error sincronizando cupón VTEX ${discount.code}: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async handleInfluencerStatusChange(influencerId: string, status: InfluencerStatus) {
    const discountCodes = this.database.listDiscountCodesByInfluencer(influencerId);
    if (!discountCodes.length) {
      this.logger.debug(`Influencer ${influencerId} sin códigos para sincronizar`);
      return;
    }

    const forceDeactivate = status !== 'approved';
    const results = await Promise.allSettled(
      discountCodes.map((code) => this.syncDiscountCode(code.id, { forceDeactivate }))
    );

    results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .forEach((result, index) => {
        const code = discountCodes[index];
        this.logger.error(`Error actualizando cupón ${code.code} tras cambio de estado de influencer: ${result.reason}`);
      });
  }

  async handleOrderWebhook(event: OrderEventPayload, options: OrderProcessingOptions): Promise<{ order: OrderEntity; commission?: CommissionRecord }> {
    const attempts = options.attempts ?? 1;
    const logId = uuid();
    const startedAt = process.hrtime.bigint();

    try {
      const record = this.database.registerOrderEvent({
        orderId: event.orderId,
        status: event.status,
        totalAmount: event.totalAmount,
        currency: event.currency,
        couponCode: event.couponCode,
        items: event.items,
        eventType: event.eventType,
        shippingAmount: event.shippingAmount,
        taxAmount: event.taxAmount,
        eligibleAmount: event.eligibleAmount,
        includeShippingInEligible: this.includeShippingInEligible,
        rawPayload: options.rawPayload ?? event.rawPayload
      });

      this.database.recordWebhookDelivery({
        id: logId,
        orderId: event.orderId,
        eventType: event.eventType,
        statusCode: 200,
        success: true,
        attempts,
        receivedAt: new Date(),
        signatureValidated: options.signatureValid
      });

      this.logger.debug(`Procesado webhook VTEX para orden ${record.order.id} -> estado ${event.status}`);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.metrics.observeWebhookProcessing({
        eventType: event.eventType,
        success: true,
        durationMs
      });
      return record;
    } catch (error) {
      this.database.recordWebhookDelivery({
        id: logId,
        orderId: event.orderId,
        eventType: event.eventType,
        statusCode: 500,
        success: false,
        attempts,
        receivedAt: new Date(),
        signatureValidated: options.signatureValid,
        lastError: error instanceof Error ? error.message : 'error no definido'
      });

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.metrics.observeWebhookProcessing({
        eventType: event.eventType,
        success: false,
        durationMs
      });
      await this.alerting.notifyWebhookFailure({
        orderId: event.orderId,
        eventType: event.eventType,
        reason: error instanceof Error ? error.message : 'error desconocido'
      });

      throw error;
    }
  }

  async recordReconciliation(dto: ReconciliationDto) {
    const record = this.database.recordReconciliation({
      runDate: new Date(dto.runDate),
      type: dto.type,
      discrepanciesFound: dto.discrepanciesFound,
      reportUrl: dto.reportUrl,
      summary: dto.summary,
      alerts: dto.alerts,
      triggeredBy: undefined
    });

    const metricType = this.normalizeReconciliationType(dto.type);
    this.metrics.recordReconciliationDiscrepancies({
      type: metricType,
      count: dto.discrepanciesFound
    });

    if (record.alerts?.length) {
      record.alerts.forEach((alert) => this.logger.warn(`[Conciliacion manual] ${alert}`));
      await this.alerting.notifyReconciliationAlert({
        discrepancies: dto.discrepanciesFound,
        alerts: record.alerts,
        type: metricType
      });
    }

    return record;
  }

  async runDailyReconciliation(date = new Date(), options: ReconciliationRunOptions = {}): Promise<ReconciliationRecord> {
    const report = await this.client.fetchDailyReport(date);
    const comparison = this.buildDiscrepancyReport(report.orders);

    const record = this.database.recordReconciliation({
      runDate: report.runDate,
      type: options.type ?? 'daily',
      discrepanciesFound: comparison.total,
      summary: {
        ordersVtex: report.orders.length,
        ordersPlatform: this.database.listOrders().length,
        discrepancies: comparison.details
      },
      alerts: comparison.alerts,
      reportUrl: undefined,
      triggeredBy: options.triggeredBy
    });

    const metricType = this.normalizeReconciliationType(options.type);
    this.metrics.recordReconciliationDiscrepancies({
      type: metricType,
      count: comparison.total
    });

    if (comparison.alerts.length) {
      comparison.alerts.forEach((alert) => this.logger.warn(`[Conciliacion] ${alert}`));
      await this.alerting.notifyReconciliationAlert({
        discrepancies: comparison.total,
        alerts: comparison.alerts,
        type: metricType
      });
    } else {
      this.logger.debug('Conciliacion diaria sin discrepancias relevantes');
    }

    return record;
  }

  listOrders(): OrderEntity[] {
    return this.database.listOrders();
  }

  private normalizeReconciliationType(type?: 'daily' | 'fortnightly' | 'adhoc'): 'daily' | 'manual' | 'fortnightly' {
    if (!type) {
      return 'daily';
    }
    return type === 'adhoc' ? 'manual' : type;
  }

  private applyCouponResponse(discountId: string, coupon: CouponResponse, activated: boolean) {
    const normalizedStatus: DiscountCodeEntity['status'] = activated
      ? 'active'
      : coupon.status === 'inactive'
        ? 'inactive'
        : 'pending';

    this.database.updateDiscountCode(discountId, {
      vtexCouponId: coupon.id,
      status: normalizedStatus
    });
  }

  private shouldActivateCoupon(input: {
    discount: DiscountCodeEntity;
    influencer?: InfluencerEntity;
    campaign?: CampaignEntity;
    options: CouponSyncOptions;
  }): boolean {
    if (input.options.forceDeactivate) {
      return false;
    }

    if (!input.influencer || !input.campaign) {
      return false;
    }

    if (input.influencer.status !== 'approved') {
      return false;
    }

    if (input.campaign.status !== 'active') {
      return false;
    }

    return true;
  }

  private async ensureCouponActive(coupon: CouponResponse): Promise<CouponResponse> {
    if (coupon.status === 'active') {
      return coupon;
    }

    return await this.client.activateCoupon(coupon.code);
  }

  private async ensureCouponInactive(coupon: CouponResponse): Promise<CouponResponse> {
    if (coupon.status === 'inactive') {
      return coupon;
    }

    return await this.client.deactivateCoupon(coupon.code);
  }

  private resolveDiscountCodeValue(discountCodeId?: string): string | undefined {
    if (!discountCodeId) {
      return undefined;
    }

    const discount = this.database.getDiscountCodeById(discountCodeId);
    return discount?.code;
  }

  private buildDiscrepancyReport(vtexOrders: DailyOrderSnapshot[]): DiscrepancyReport {
    const orders = this.database.listOrders();
    const ordersMap = new Map(orders.map((order) => [order.id, order]));
    const vtexMap = new Map(vtexOrders.map((order) => [order.orderId, order]));

    const missingInPlatform: DailyOrderSnapshot[] = [];
    const missingInVtex: OrderEntity[] = [];
    const statusMismatch: { orderId: string; platform: string; vtex: string }[] = [];
    const amountMismatch: { orderId: string; platform: number; vtex: number }[] = [];
    const couponMismatch: { orderId: string; platform?: string; vtex?: string }[] = [];

    for (const vtexOrder of vtexOrders) {
      const platformOrder = ordersMap.get(vtexOrder.orderId);
      if (!platformOrder) {
        missingInPlatform.push(vtexOrder);
        continue;
      }

      if (platformOrder.status !== vtexOrder.status) {
        statusMismatch.push({
          orderId: vtexOrder.orderId,
          platform: platformOrder.status,
          vtex: vtexOrder.status
        });
      }

      if (!this.amountWithinTolerance(platformOrder.totalAmount, vtexOrder.totalAmount)) {
        amountMismatch.push({
          orderId: vtexOrder.orderId,
          platform: platformOrder.totalAmount,
          vtex: vtexOrder.totalAmount
        });
      }

      const platformCoupon = this.resolveDiscountCodeValue(platformOrder.discountCodeId);
      if ((platformCoupon ?? undefined) !== (vtexOrder.couponCode ?? undefined)) {
        couponMismatch.push({
          orderId: vtexOrder.orderId,
          platform: platformCoupon,
          vtex: vtexOrder.couponCode
        });
      }
    }

    for (const order of orders) {
      if (!vtexMap.has(order.id)) {
        missingInVtex.push(order);
      }
    }

    const total =
      missingInPlatform.length +
      missingInVtex.length +
      statusMismatch.length +
      amountMismatch.length +
      couponMismatch.length;

    const alerts: string[] = [];
    if (missingInPlatform.length) {
      alerts.push(`${missingInPlatform.length} pedidos existen en VTEX pero faltan en la plataforma`);
    }
    if (missingInVtex.length) {
      alerts.push(`${missingInVtex.length} pedidos existen en la plataforma pero no en VTEX`);
    }
    if (amountMismatch.length) {
      alerts.push(`${amountMismatch.length} pedidos con montos distintos (> ${AMOUNT_TOLERANCE * 100}% diferencia)`);
    }

    const details = {
      missingInPlatform,
      missingInVtex,
      statusMismatch,
      amountMismatch,
      couponMismatch
    };

    return { total, alerts, details };
  }

  private amountWithinTolerance(platformAmount: number, vtexAmount: number): boolean {
    if (platformAmount === vtexAmount) {
      return true;
    }

    if (platformAmount === 0) {
      return Math.abs(vtexAmount) < 1;
    }

    const delta = Math.abs(platformAmount - vtexAmount) / Math.max(platformAmount, 1);
    return delta <= AMOUNT_TOLERANCE;
  }
}
