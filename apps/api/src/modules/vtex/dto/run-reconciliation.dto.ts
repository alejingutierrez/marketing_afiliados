import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class RunReconciliationDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(['daily', 'fortnightly', 'adhoc'])
  type?: 'daily' | 'fortnightly' | 'adhoc';
}
