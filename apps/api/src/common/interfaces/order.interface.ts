export type OrderStatus = 'created' | 'paid' | 'invoiced' | 'shipped' | 'canceled' | 'returned';

export interface OrderItemEntity {
  skuId: string;
  skuRef?: string;
  quantity: number;
  price: number;
  discount?: number;
  taxAmount?: number;
  categoryId?: string;
  categoryName?: string;
}

export interface OrderEntity {
  id: string;
  tenantId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  shippingAmount?: number;
  taxAmount?: number;
  eligibleAmount?: number;
  discountCodeId?: string;
  influencerId?: string;
  campaignId?: string;
  items: OrderItemEntity[];
  createdAt: Date;
  updatedAt: Date;
  rawPayload?: unknown;
}

export type CommissionState = 'ESTIMATED' | 'CONFIRMED' | 'REVERTED';

export interface CommissionAuditEntry {
  id: string;
  commissionId: string;
  previousState: CommissionState | null;
  nextState: CommissionState;
  changedAt: Date;
  triggeredBy?: string;
  context?: string;
}

export interface CommissionRecord {
  id: string;
  tenantId: string;
  orderId: string;
  influencerId: string;
  campaignId: string;
  state: CommissionState;
  grossAmount: number;
  eligibleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  tierLevel: number;
  tierName: string;
  calculatedAt: Date;
  confirmedAt?: Date;
  revertedAt?: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
  auditTrail: CommissionAuditEntry[];
}

export interface InfluencerBalanceRecord {
  influencerId: string;
  tenantId: string;
  estimatedAmount: number;
  confirmedAmount: number;
  revertedAmount: number;
  pendingWithdrawalAmount: number;
  withdrawnAmount: number;
  adjustmentAmount: number;
  availableForWithdrawal: number;
  lastCalculatedAt: Date;
}

export interface TierAssignmentHistoryRecord {
  id: string;
  influencerId: string;
  campaignId: string;
  tierLevel: number;
  tierName: string;
  commissionRate: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  reason?: string;
  triggeredBy?: string;
  windowStart: Date;
  windowEnd: Date;
  salesVolume: number;
}

export interface TierEvaluationResult {
  influencerId: string;
  campaignId: string;
  previousTier: { name: string; level: number; commissionRate: number };
  newTier: { name: string; level: number; commissionRate: number };
  changed: boolean;
  salesVolume: number;
  windowStart: Date;
  windowEnd: Date;
  triggeredBy?: string;
}

export interface SettlementTransitionRecord {
  commissionId: string;
  orderId: string;
  previousState: CommissionState;
  nextState: CommissionState;
  influencerId: string;
  campaignId: string;
  commissionAmount: number;
  effectiveAt: Date;
  reason?: string;
}

export interface CommissionSettlementSummary {
  evaluationDate: Date;
  waitingPeriodDays: number;
  confirmed: SettlementTransitionRecord[];
  reverted: SettlementTransitionRecord[];
  pending: SettlementTransitionRecord[];
}

export interface ReconciliationRecord {
  id: string;
  tenantId: string;
  runDate: Date;
  type: 'daily' | 'fortnightly' | 'adhoc';
  discrepanciesFound: number;
  reportUrl?: string;
  summary?: Record<string, unknown>;
  alerts?: string[];
  createdAt: Date;
}

export interface WebhookDeliveryLog {
  id: string;
  orderId?: string;
  eventType?: string;
  statusCode: number;
  success: boolean;
  receivedAt: Date;
  attempts: number;
  lastError?: string;
  signatureValidated: boolean;
}
