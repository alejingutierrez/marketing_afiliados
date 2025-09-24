/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Injectable, NotFoundException } from '@nestjs/common';

import type { CampaignEntity, CampaignStatus } from '../../common/interfaces/campaign.interface';
import type { DiscountCodeStatus } from '../../common/interfaces/discount-code.interface';
import type {
  InfluencerDocument,
  InfluencerEntity,
  InfluencerStatus
} from '../../common/interfaces/influencer.interface';
import type {
  CommissionRecord,
  InfluencerBalanceRecord,
  OrderEntity,
  ReconciliationRecord,
  TierAssignmentHistoryRecord
} from '../../common/interfaces/order.interface';
import type {
  BrandWithdrawalPolicy,
  PaymentRecord,
  WithdrawalAdjustmentRecord,
  WithdrawalRequestRecord
} from '../../common/interfaces/payment.interface';
import { AppRole } from '../../common/interfaces/roles.enum';
import type { AuthenticatedUserPayload } from '../../common/interfaces/user.interface';
import { InMemoryDatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { NotificationEvent } from '../notifications/notifications.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

interface InfluencerDashboardMetrics {
  totalSales: number;
  estimatedCommission: number;
  confirmedCommission: number;
  reversedCommission: number;
  pendingWithdrawals: number;
  withdrawnAmount: number;
}

interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  orders: number;
  salesAmount: number;
  estimatedCommission: number;
  confirmedCommission: number;
}

interface TierProgress {
  campaignId: string;
  campaignName: string;
  currentTier: string;
  nextTier?: string;
  progressPercentage: number;
  salesVolume: number;
  nextThreshold?: number;
}

export interface InfluencerDashboardPayload {
  influencer: Pick<InfluencerEntity, 'id' | 'firstName' | 'lastName' | 'status' | 'email'> & {
    city?: string;
    country?: string;
    socialLinks?: string[];
    documents?: InfluencerDocument[];
  };
  metrics: InfluencerDashboardMetrics;
  balances: InfluencerBalanceRecord | null;
  salesByCampaign: CampaignPerformance[];
  tierProgress: TierProgress[];
  tierHistory: TierAssignmentHistoryRecord[];
  withdrawals: WithdrawalRequestRecord[];
  payments: PaymentRecord[];
  adjustments: WithdrawalAdjustmentRecord[];
  notifications: NotificationEvent[];
}

interface GestorDashboardStats {
  totalInfluencers: number;
  activeInfluencers: number;
  pendingInfluencers: number;
  activeCampaigns: number;
  totalCodes: number;
}

interface GestorPendingApproval {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: InfluencerStatus;
  createdAt: Date;
}

interface GestorCampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  brandId: string;
  brandName: string;
  startDate: Date;
  endDate?: Date;
  commissionBase: number;
}

interface GestorCodeSummary {
  id: string;
  code: string;
  status: DiscountCodeStatus;
  campaignId: string;
  influencerId: string;
  createdAt: Date;
}

export interface GestorDashboardPayload {
  stats: GestorDashboardStats;
  influencersByStatus: Array<{ status: InfluencerStatus; count: number }>;
  pendingApprovals: GestorPendingApproval[];
  campaigns: GestorCampaignSummary[];
  recentCodes: GestorCodeSummary[];
  notifications: NotificationEvent[];
}

export interface FinanceDashboardPayload {
  policies: BrandWithdrawalPolicy[];
  withdrawals: WithdrawalRequestRecord[];
  payments: PaymentRecord[];
  adjustments: WithdrawalAdjustmentRecord[];
  balances: InfluencerBalanceRecord[];
  reconciliations: ReconciliationRecord[];
}

export interface AdminDashboardPayload {
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
  alerts: NotificationEvent[];
  auditTrail: ReturnType<InMemoryDatabaseService['listCommissionAuditTrail']>;
  recentReconciliations: ReconciliationRecord[];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly database: InMemoryDatabaseService,
    private readonly notifications: NotificationsService
  ) {}

  getInfluencerDashboard(influencerId: string): InfluencerDashboardPayload {
    const influencer = this.database.getInfluencerById(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer ${influencerId} no encontrado`);
    }

    const orders = this.database
      .listOrders()
      .filter((order) => order.influencerId === influencerId);
    const commissions = this.database
      .listCommissions()
      .filter((commission) => commission.influencerId === influencerId);
    const withdrawals = this.database.listWithdrawalRequests({ influencerId });
    const payments = this.database.listPayments({ influencerId });
    const adjustments = this.database.listWithdrawalAdjustments({ influencerId });
    const balances = this.database.getInfluencerBalance(influencerId) ?? null;
    const tierHistory = this.database.listTierHistory({ influencerId });
    const notifications = this.notifications
      .pending()
      .filter((event) =>
        event.recipient === `influencer:${influencerId}` || event.recipient === 'global'
      );

    const metrics = this.buildInfluencerMetrics({ commissions, withdrawals, payments, orders });
    const salesByCampaign = this.groupSalesByCampaign({ orders, commissions });
    const tierProgress = this.resolveTierProgress({ influencerId, tierHistory, orders });

    return {
      influencer: {
        id: influencer.id,
        firstName: influencer.firstName,
        lastName: influencer.lastName,
        status: influencer.status,
        email: influencer.email,
        city: influencer.city,
        country: influencer.country,
        socialLinks: influencer.socialLinks,
        documents: influencer.documents ?? []
      },
      metrics,
      balances,
      salesByCampaign,
      tierProgress,
      tierHistory,
      withdrawals,
      payments,
      adjustments,
      notifications
    };
  }

  getGestorDashboard(): GestorDashboardPayload {
    const influencers = this.database.listInfluencers();
    const campaigns = this.database.listCampaigns();
    const discountCodes = this.database.listDiscountCodes();
    const notifications = this.notifications
      .pending()
      .filter((event) => event.recipient === 'gestor@medipiel.co' || event.recipient === 'global');

    const influencersByStatus = this.countInfluencersByStatus(influencers);
    const stats: GestorDashboardStats = {
      totalInfluencers: influencers.length,
      activeInfluencers: influencers.filter((influencer) => influencer.status === 'approved').length,
      pendingInfluencers: influencers.filter((influencer) => influencer.status === 'pending').length,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
      totalCodes: discountCodes.length
    };

    const pendingApprovals = influencers
      .filter((influencer) => influencer.status === 'pending')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((influencer) => ({
        id: influencer.id,
        firstName: influencer.firstName,
        lastName: influencer.lastName,
        email: influencer.email,
        status: influencer.status,
        createdAt: influencer.createdAt
      }));

    const campaignSummaries = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      brandId: campaign.brandId,
      brandName: campaign.brandName,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      commissionBase: campaign.commissionBase
    }));

    const recentCodes = discountCodes
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 10)
      .map((code) => ({
        id: code.id,
        code: code.code,
        status: code.status,
        campaignId: code.campaignId,
        influencerId: code.influencerId,
        createdAt: code.createdAt
      }));

    return {
      stats,
      influencersByStatus,
      pendingApprovals,
      campaigns: campaignSummaries,
      recentCodes,
      notifications
    };
  }

  getFinanceDashboard(): FinanceDashboardPayload {
    const policies = this.database.getBrandWithdrawalPolicies();
    const withdrawals = this.database.listWithdrawalRequests();
    const payments = this.database.listPayments();
    const adjustments = this.database.listWithdrawalAdjustments();
    const balances = this.database.listInfluencerBalances();
    const reconciliations = this.database.listReconciliations().slice(-10);

    return {
      policies,
      withdrawals,
      payments,
      adjustments,
      balances,
      reconciliations
    };
  }

  getAdminDashboard(): AdminDashboardPayload {
    const influencers = this.database.listInfluencers();
    const campaigns = this.database.listCampaigns();
    const commissions = this.database.listCommissions();
    const withdrawals = this.database.listWithdrawalRequests();
    const reconciliations = this.database.listReconciliations().slice(-10);
    const auditTrail = this.database.listCommissionAuditTrail().slice(-15);
    const notifications = this.notifications.pending().filter((event) =>
      ['admin@medipiel.co', 'auditor@medipiel.co', 'global'].includes(event.recipient)
    );

    const brandPerformance = this.aggregatePerformanceByBrand(commissions, campaigns, withdrawals);

    const stats = {
      influencers: influencers.length,
      brands: new Set(campaigns.map((campaign) => campaign.brandId)).size,
      campaigns: campaigns.length,
      confirmedCommission: this.sumBy(
        commissions.filter((commission) => commission.state === 'CONFIRMED'),
        (commission) => commission.commissionAmount
      )
    };

    const topInfluencers = this.computeTopInfluencers(commissions, influencers).slice(0, 8);

    return {
      stats,
      topInfluencers,
      performanceByBrand: brandPerformance,
      alerts: notifications,
      auditTrail,
      recentReconciliations: reconciliations
    };
  }

  getDefaultDashboardPath(user: AuthenticatedUserPayload): string {
    if (user.roles.includes(AppRole.ADMIN_DENTSU) || user.roles.includes(AppRole.AUDITOR)) {
      return '/dashboard/admin';
    }
    if (user.roles.includes(AppRole.FINANCE)) {
      return '/dashboard/finance';
    }
    if (user.roles.includes(AppRole.GESTOR_AFILIADOS) || user.roles.includes(AppRole.ADMIN_MARCA)) {
      return '/dashboard/gestor';
    }
    if (user.roles.includes(AppRole.INFLUENCER)) {
      return '/dashboard/influencer';
    }
    return '/dashboard';
  }

  private buildInfluencerMetrics(input: {
    commissions: CommissionRecord[];
    withdrawals: WithdrawalRequestRecord[];
    payments: PaymentRecord[];
    orders: OrderEntity[];
  }): InfluencerDashboardMetrics {
    const estimatedCommission = this.sumBy(
      input.commissions.filter((commission) => commission.state === 'ESTIMATED'),
      (commission) => commission.commissionAmount
    );
    const confirmedCommission = this.sumBy(
      input.commissions.filter((commission) => commission.state === 'CONFIRMED'),
      (commission) => commission.commissionAmount
    );
    const reversedCommission = this.sumBy(
      input.commissions.filter((commission) => commission.state === 'REVERTED'),
      (commission) => commission.commissionAmount
    );

    const pendingWithdrawals = this.sumBy(
      input.withdrawals.filter((withdrawal) => withdrawal.status === 'pending'),
      (withdrawal) => withdrawal.requestedAmount
    );

    const withdrawnAmount = this.sumBy(input.payments, (payment) => payment.amount);
    const totalSales = this.sumBy(
      input.orders,
      (order) => order.eligibleAmount ?? order.totalAmount ?? 0
    );

    return {
      totalSales,
      estimatedCommission,
      confirmedCommission,
      reversedCommission,
      pendingWithdrawals,
      withdrawnAmount
    };
  }

  private groupSalesByCampaign(input: {
    orders: OrderEntity[];
    commissions: CommissionRecord[];
  }): CampaignPerformance[] {
    const byCampaign = new Map<string, CampaignPerformance>();

    for (const order of input.orders) {
      if (!order.campaignId) {
        continue;
      }
      const key = order.campaignId;
      const existing = byCampaign.get(key);
      const commissionForOrder = input.commissions.filter(
        (commission) => commission.orderId === order.id
      );
      const estimatedCommission = this.sumBy(commissionForOrder, (commission) =>
        commission.state === 'ESTIMATED' ? commission.commissionAmount : 0
      );
      const confirmedCommission = this.sumBy(commissionForOrder, (commission) =>
        commission.state === 'CONFIRMED' ? commission.commissionAmount : 0
      );
      const performance: CampaignPerformance = existing ?? {
        campaignId: key,
        campaignName: '',
        orders: 0,
        salesAmount: 0,
        estimatedCommission: 0,
        confirmedCommission: 0
      };

      performance.orders += 1;
      performance.salesAmount += order.eligibleAmount ?? order.totalAmount ?? 0;
      performance.estimatedCommission += estimatedCommission;
      performance.confirmedCommission += confirmedCommission;

      byCampaign.set(key, performance);
    }

    for (const [campaignId, performance] of byCampaign) {
      const campaign = this.database.getCampaignById(campaignId);
      if (campaign) {
        performance.campaignName = campaign.name;
      }
    }

    return Array.from(byCampaign.values());
  }

  private resolveTierProgress(input: {
    influencerId: string;
    tierHistory: TierAssignmentHistoryRecord[];
    orders: OrderEntity[];
  }): TierProgress[] {
    const groupedByCampaign = new Map<string, TierProgress>();

    for (const history of input.tierHistory) {
      const key = history.campaignId;
      const performance = groupedByCampaign.get(key) ?? {
        campaignId: key,
        campaignName: this.database.getCampaignById(key)?.name ?? 'Campaña',
        currentTier: history.tierName,
        nextTier: undefined,
        progressPercentage: 0,
        salesVolume: history.salesVolume,
        nextThreshold: undefined
      };

      performance.currentTier = history.tierName;
      performance.salesVolume = history.salesVolume;
      groupedByCampaign.set(key, performance);
    }

    for (const [campaignId, progress] of groupedByCampaign) {
      const campaign = this.database.getCampaignById(campaignId);
      if (!campaign || !campaign.tiers?.length) {
        continue;
      }

      const tiersSorted = [...campaign.tiers].sort((a, b) => a.level - b.level);
      const currentIndex = tiersSorted.findIndex((tier) => tier.name === progress.currentTier);
      const nextTier = currentIndex >= 0 ? tiersSorted[currentIndex + 1] : undefined;
      if (nextTier) {
        progress.nextTier = nextTier.name;
        progress.nextThreshold = nextTier.thresholdConfirmedSales;
        progress.progressPercentage = Math.min(
          100,
          Math.round((progress.salesVolume / nextTier.thresholdConfirmedSales) * 100)
        );
      } else {
        progress.progressPercentage = 100;
      }
    }

    return Array.from(groupedByCampaign.values());
  }

  private countInfluencersByStatus(influencers: InfluencerEntity[]) {
    const map = new Map<InfluencerStatus, number>();
    for (const influencer of influencers) {
      map.set(influencer.status, (map.get(influencer.status) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }

  private aggregatePerformanceByBrand(
    commissions: CommissionRecord[],
    campaigns: CampaignEntity[],
    _withdrawals: WithdrawalRequestRecord[]
  ) {
    const byBrand = new Map<
      string,
      {
        brandId: string;
        brandName: string;
        totalSales: number;
        confirmedCommission: number;
      }
    >();

    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign] as const));

    for (const commission of commissions) {
      const campaign = campaignById.get(commission.campaignId);
      if (!campaign) {
        continue;
      }
      const entry = byBrand.get(campaign.brandId) ?? {
        brandId: campaign.brandId,
        brandName: campaign.brandName ?? campaign.name,
        totalSales: 0,
        confirmedCommission: 0
      };

      if (commission.state === 'CONFIRMED') {
        entry.confirmedCommission += commission.commissionAmount;
      }
      entry.totalSales += commission.eligibleAmount ?? 0;
      byBrand.set(campaign.brandId, entry);
    }
    return Array.from(byBrand.values());
  }

  private computeTopInfluencers(
    commissions: CommissionRecord[],
    influencers: InfluencerEntity[]
  ) {
    const byInfluencer = new Map<
      string,
      {
        influencerId: string;
        confirmedCommission: number;
        estimatedCommission: number;
      }
    >();

    for (const commission of commissions) {
      const entry = byInfluencer.get(commission.influencerId) ?? {
        influencerId: commission.influencerId,
        confirmedCommission: 0,
        estimatedCommission: 0
      };

      if (commission.state === 'CONFIRMED') {
        entry.confirmedCommission += commission.commissionAmount;
      } else if (commission.state === 'ESTIMATED') {
        entry.estimatedCommission += commission.commissionAmount;
      }

      byInfluencer.set(commission.influencerId, entry);
    }

    const nameById = new Map(
      influencers.map((influencer) => [
        influencer.id,
        `${influencer.firstName ?? ''} ${influencer.lastName ?? ''}`.trim()
      ])
    );

    return Array.from(byInfluencer.values())
      .map((entry) => ({
        ...entry,
        name: nameById.get(entry.influencerId) ?? 'Sin nombre'
      }))
      .sort((a, b) => b.confirmedCommission - a.confirmedCommission);
  }

  private sumBy<T>(items: T[], selector: (item: T) => number): number {
    return items.reduce((acc, item) => acc + (selector(item) ?? 0), 0);
  }
}
