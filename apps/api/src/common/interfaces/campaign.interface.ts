export type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended';

export interface CampaignTierConfig {
  name: string;
  level: number;
  commissionPercent: number;
  thresholdConfirmedSales: number;
}

export interface CampaignEntity {
  id: string;
  tenantId: string;
  brandId: string;
  brandName: string;
  name: string;
  slug: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  status: CampaignStatus;
  commissionBase: number;
  commissionBasis: 'pre_tax' | 'post_tax';
  eligibleScopeType: 'sku' | 'category';
  eligibleScopeValues?: string[];
  maxDiscountPercent?: number;
  maxUsage?: number;
  tierEvaluationPeriodDays?: number;
  tiers: CampaignTierConfig[];
  assignedInfluencerIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
