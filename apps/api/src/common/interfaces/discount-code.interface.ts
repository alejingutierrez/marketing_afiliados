export type DiscountCodeStatus = 'pending' | 'active' | 'inactive';

export interface DiscountCodeEntity {
  id: string;
  tenantId: string;
  campaignId: string;
  influencerId: string;
  code: string;
  status: DiscountCodeStatus;
  discountPercent?: number;
  startDate?: Date;
  endDate?: Date;
  maxUsage?: number;
  usageCount: number;
  conditions?: Record<string, unknown>;
  vtexCouponId?: string;
  createdAt: Date;
  updatedAt: Date;
}
