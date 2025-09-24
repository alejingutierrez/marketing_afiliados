import type {
  CouponResponse,
  CreateCouponInput,
  DailyOrderSnapshot,
  DailyReportResponse,
  OrderEventPayload,
  WebhookValidationResult
} from '@vtex-client';

function asOrderItemList(payload: unknown): OrderEventPayload['items'] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((item, index) => {
    const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
    return {
      skuId: String(record.skuId ?? `SKU-${index}`),
      skuRef: record.skuRef ? String(record.skuRef) : undefined,
      quantity: Number(record.quantity ?? 1),
      price: Number(record.price ?? 0),
      listPrice: record.listPrice ? Number(record.listPrice) : undefined,
      discount: record.discount ? Number(record.discount) : undefined,
      taxAmount: record.taxAmount ? Number(record.taxAmount) : undefined,
      categoryName: record.categoryName ? String(record.categoryName) : undefined
    };
  });
}

export class MockVtexClient {
  public readonly coupons = new Map<string, CouponResponse>();
  public readonly createCalls: CreateCouponInput[] = [];
  public readonly activations: string[] = [];
  public readonly deactivations: string[] = [];
  public dailyOrders: DailyOrderSnapshot[] = [];
  public webhookValid = true;

  async createOrUpdateCoupon(input: CreateCouponInput): Promise<CouponResponse> {
    this.createCalls.push(input);
    const coupon = this.buildCouponResponse(input.code, {
      status: input.isActive === false ? 'inactive' : 'active',
      discountPercent: input.discountPercent,
      maxUsage: input.maxUsage,
      campaignId: input.campaignId,
      influencerId: input.influencerId,
      metadata: input.metadata
    });
    this.coupons.set(coupon.code.toUpperCase(), coupon);
    return coupon;
  }

  async activateCoupon(code: string): Promise<CouponResponse> {
    const coupon = this.ensureCoupon(code);
    const updated = { ...coupon, status: 'active' as const };
    this.coupons.set(updated.code.toUpperCase(), updated);
    this.activations.push(code);
    return updated;
  }

  async deactivateCoupon(code: string): Promise<CouponResponse> {
    const coupon = this.ensureCoupon(code);
    const updated = { ...coupon, status: 'inactive' as const };
    this.coupons.set(updated.code.toUpperCase(), updated);
    this.deactivations.push(code);
    return updated;
  }

  verifyWebhookSignature(): WebhookValidationResult {
    return { valid: this.webhookValid };
  }

  mapOrderPayload(payload: Record<string, unknown>): OrderEventPayload {
    return {
      orderId: String(payload.orderId ?? 'mock-order'),
      eventType: (payload.eventType as OrderEventPayload['eventType']) ?? 'order-created',
      status: (payload.status as OrderEventPayload['status']) ?? 'created',
      totalAmount: Number(payload.totalAmount ?? 0),
      currency: String(payload.currency ?? 'COP'),
      couponCode: payload.couponCode ? String(payload.couponCode) : undefined,
      shippingAmount: payload.shippingAmount ? Number(payload.shippingAmount) : undefined,
      taxAmount: payload.taxAmount ? Number(payload.taxAmount) : undefined,
      eligibleAmount: payload.eligibleAmount ? Number(payload.eligibleAmount) : undefined,
      items: asOrderItemList(payload.items),
      rawPayload: payload
    };
  }

  setDailyOrders(orders: DailyOrderSnapshot[]) {
    this.dailyOrders = orders;
  }

  async fetchDailyReport(date: Date): Promise<DailyReportResponse> {
    return {
      runDate: date,
      orders: this.dailyOrders,
      rawPayload: { source: 'mock' }
    };
  }

  private ensureCoupon(code: string): CouponResponse {
    const existing = this.coupons.get(code.toUpperCase());
    if (existing) {
      return existing;
    }

    const coupon = this.buildCouponResponse(code, { status: 'pending' });
    this.coupons.set(coupon.code.toUpperCase(), coupon);
    return coupon;
  }

  private buildCouponResponse(code: string, overrides: Partial<CouponResponse>): CouponResponse {
    return {
      id: `mock-${code}`,
      code,
      status: 'active',
      ...overrides
    };
  }
}
