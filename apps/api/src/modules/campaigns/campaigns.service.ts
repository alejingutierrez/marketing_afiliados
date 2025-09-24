import { Injectable, NotFoundException } from '@nestjs/common';

import type { CampaignEntity } from '../../common/interfaces/campaign.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InMemoryDatabaseService } from '../../database/database.service';

import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly database: InMemoryDatabaseService) {}

  list(): CampaignEntity[] {
    return this.database.listCampaigns();
  }

  create(dto: CreateCampaignDto): CampaignEntity {
    return this.database.createCampaign({
      tenantId: 'medipiel',
      brandId: dto.brandId,
      brandName: dto.brandName,
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      status: dto.status,
      commissionBase: dto.commissionBase,
      commissionBasis: dto.commissionBasis,
      eligibleScopeType: dto.eligibleScopeType,
      eligibleScopeValues: dto.eligibleScopeValues,
      maxDiscountPercent: dto.maxDiscountPercent,
      maxUsage: dto.maxUsage,
      tiers: dto.tiers?.map((tier) => ({
        name: tier.name,
        level: tier.level,
        commissionPercent: tier.commissionPercent,
        thresholdConfirmedSales: tier.thresholdConfirmedSales
      }))
    });
  }

  update(id: string, dto: UpdateCampaignDto) {
    const updated = this.database.updateCampaign({
      campaignId: id,
      description: dto.description,
      status: dto.status,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      maxDiscountPercent: dto.maxDiscountPercent,
      maxUsage: dto.maxUsage,
      tiers: dto.tiers?.map((tier) => ({
        name: tier.name,
        level: tier.level,
        commissionPercent: tier.commissionPercent,
        thresholdConfirmedSales: tier.thresholdConfirmedSales
      }))
    });

    if (!updated) {
      throw new NotFoundException(`Campaña ${id} no encontrada`);
    }

    return updated;
  }
}
