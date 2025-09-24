import { IsOptional, IsString } from 'class-validator';

export class ListWithdrawalsQueryDto {
  @IsOptional()
  @IsString()
  influencerId?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
