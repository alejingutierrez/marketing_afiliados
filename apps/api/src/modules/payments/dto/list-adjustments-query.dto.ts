import { IsOptional, IsString } from 'class-validator';

export class ListAdjustmentsQueryDto {
  @IsOptional()
  @IsString()
  influencerId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
