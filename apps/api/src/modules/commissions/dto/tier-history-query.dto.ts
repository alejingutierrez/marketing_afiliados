import { IsOptional, IsString } from 'class-validator';

export class TierHistoryQueryDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  influencerId?: string;
}
