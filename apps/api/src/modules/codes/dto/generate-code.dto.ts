import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateCodeDto {
  @IsString()
  campaignId!: string;

  @IsString()
  influencerId!: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxUsage?: number;
}
