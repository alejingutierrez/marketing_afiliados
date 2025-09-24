import type { InfluencerStatus } from '@/types/influencer';

export interface DashboardNotification {
  id: string;
  type: string;
  recipient: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface InfluencerBalance {
  influencerId: string;
  tenantId: string;
  estimatedAmount: number;
  confirmedAmount: number;
  revertedAmount: number;
  pendingWithdrawalAmount: number;
  withdrawnAmount: number;
  adjustmentAmount: number;
  availableForWithdrawal: number;
  lastCalculatedAt: string;
}

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  orders: number;
  salesAmount: number;
  estimatedCommission: number;
  confirmedCommission: number;
}

export interface TierProgress {
  campaignId: string;
  campaignName: string;
  currentTier: string;
  nextTier?: string;
  progressPercentage: number;
  salesVolume: number;
  nextThreshold?: number;
}

export interface InfluencerDashboardData {
  influencer: {
    id: string;
    firstName: string;
    lastName: string;
    status: InfluencerStatus;
    email: string;
    city?: string;
    country?: string;
    socialLinks?: string[];
  };
  metrics: {
    totalSales: number;
    estimatedCommission: number;
    confirmedCommission: number;
    reversedCommission: number;
    pendingWithdrawals: number;
    withdrawnAmount: number;
  };
  balances: InfluencerBalance | null;
  salesByCampaign: CampaignPerformance[];
  tierProgress: TierProgress[];
  tierHistory: TierHistoryEntry[];
  withdrawals: WithdrawalRequest[];
  payments: PaymentRecord[];
  adjustments: WithdrawalAdjustment[];
  notifications: DashboardNotification[];
}

export interface TierHistoryEntry {
  id: string;
  influencerId: string;
  campaignId: string;
  tierLevel: number;
  tierName: string;
  commissionRate: number;
  effectiveFrom: string;
  effectiveTo?: string;
  reason?: string;
  triggeredBy?: string;
  windowStart: string;
  windowEnd: string;
  salesVolume: number;
}

export interface WithdrawalRequest {
  id: string;
  tenantId: string;
  influencerId: string;
  brandId: string;
  brandName: string;
  requestedAmount: number;
  currency: string;
  status: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  paymentReference?: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  tenantId: string;
  influencerId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  method: string;
  reference?: string;
  voucherUrl?: string;
  taxWithheld?: number;
  processedBy: string;
  createdAt: string;
}

export interface WithdrawalAdjustment {
  id: string;
  influencerId: string;
  campaignId?: string;
  brandId?: string;
  orderId?: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  reason: string;
  reconciliationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GestorDashboardData {
  stats: {
    totalInfluencers: number;
    activeInfluencers: number;
    pendingInfluencers: number;
    activeCampaigns: number;
    totalCodes: number;
  };
  influencersByStatus: Array<{ status: InfluencerStatus; count: number }>;
  pendingApprovals: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    status: InfluencerStatus;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    brandName?: string;
    startDate: string;
  }>;
  recentCodes: Array<{
    id: string;
    code: string;
    status: string;
    campaignId: string;
    influencerId: string;
    createdAt: string;
  }>;
  notifications: DashboardNotification[];
}

export interface FinanceDashboardData {
  policies: Array<{
    brandId: string;
    brandName: string;
    minimumAmount: number;
    currency: string;
    waitingPeriodDays?: number;
  }>;
  withdrawals: WithdrawalRequest[];
  payments: PaymentRecord[];
  adjustments: WithdrawalAdjustment[];
  balances: InfluencerBalance[];
  reconciliations: Array<{
    id: string;
    runDate: string;
    type: string;
    discrepanciesFound: number;
    reportUrl?: string;
  }>;
}

export interface AdminDashboardData {
  stats: {
    influencers: number;
    brands: number;
    campaigns: number;
    confirmedCommission: number;
  };
  topInfluencers: Array<{
    influencerId: string;
    name: string;
    confirmedCommission: number;
    estimatedCommission: number;
  }>;
  performanceByBrand: Array<{
    brandId: string;
    brandName: string;
    totalSales: number;
    confirmedCommission: number;
  }>;
  alerts: DashboardNotification[];
  auditTrail: Array<{
    id: string;
    commissionId: string;
    previousState: string | null;
    nextState: string;
    changedAt: string;
    context?: string;
  }>;
  recentReconciliations: Array<{
    id: string;
    runDate: string;
    type: string;
    discrepanciesFound: number;
  }>;
}
