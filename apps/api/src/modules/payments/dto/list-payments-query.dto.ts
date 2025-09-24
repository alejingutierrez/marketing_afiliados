import { IsOptional, IsString } from 'class-validator';

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsString()
  influencerId?: string;
}
