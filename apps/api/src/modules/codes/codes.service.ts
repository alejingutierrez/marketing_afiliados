import { Injectable } from '@nestjs/common';

import type { DiscountCodeEntity } from '../../common/interfaces/discount-code.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InMemoryDatabaseService } from '../../database/database.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { VtexService } from '../vtex/vtex.service';

import type { GenerateCodeDto } from './dto/generate-code.dto';

@Injectable()
export class CodesService {
  constructor(
    private readonly database: InMemoryDatabaseService,
    private readonly vtexService: VtexService
  ) {}

  list(): DiscountCodeEntity[] {
    return this.database.listDiscountCodes();
  }

  async generate(dto: GenerateCodeDto): Promise<DiscountCodeEntity> {
    const discount = this.database.createDiscountCode({
      tenantId: 'medipiel',
      campaignId: dto.campaignId,
      influencerId: dto.influencerId,
      prefix: dto.prefix,
      discountPercent: dto.discountPercent,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      maxUsage: dto.maxUsage
    });

    await this.vtexService.syncDiscountCode(discount.id);
    return this.database.getDiscountCodeById(discount.id) ?? discount;
  }

  async sync(codeId: string): Promise<DiscountCodeEntity | undefined> {
    await this.vtexService.syncDiscountCode(codeId);
    return this.database.getDiscountCodeById(codeId);
  }
}
