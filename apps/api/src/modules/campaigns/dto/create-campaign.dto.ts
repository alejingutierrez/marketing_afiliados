import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

class CampaignTierDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(1)
  level!: number;

  @IsNumber()
  @Min(0)
  thresholdConfirmedSales!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent!: number;
}

type CommissionBasis = 'pre_tax' | 'post_tax';

type EligibleScopeType = 'sku' | 'category';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  brandId!: string;

  @IsString()
  @IsNotEmpty()
  brandName!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsEnum(['draft', 'active', 'paused', 'ended'])
  status!: 'draft' | 'active' | 'paused' | 'ended';

  @IsNumber()
  @Min(0)
  @Max(100)
  commissionBase!: number;

  @IsEnum(['pre_tax', 'post_tax'])
  commissionBasis!: CommissionBasis;

  @IsEnum(['sku', 'category'])
  eligibleScopeType!: EligibleScopeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleScopeValues?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxUsage?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CampaignTierDto)
  tiers?: CampaignTierDto[];
}
