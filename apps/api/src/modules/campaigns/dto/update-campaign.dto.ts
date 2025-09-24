import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

class CampaignTierUpdateDto {
  @IsString()
  name!: string;

  @IsNumber()
  level!: number;

  @IsNumber()
  @Min(0)
  thresholdConfirmedSales!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent!: number;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['draft', 'active', 'paused', 'ended'])
  status?: 'draft' | 'active' | 'paused' | 'ended';

  @IsOptional()
  @IsDateString()
  endDate?: string;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignTierUpdateDto)
  tiers?: CampaignTierUpdateDto[];
}
