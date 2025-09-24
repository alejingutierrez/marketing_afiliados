import { IsArray, IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class ReconciliationDto {
  @IsDateString()
  runDate!: string;

  @IsIn(['daily', 'fortnightly', 'adhoc'])
  type!: 'daily' | 'fortnightly' | 'adhoc';

  @IsNumber()
  discrepanciesFound!: number;

  @IsOptional()
  @IsString()
  reportUrl?: string;

  @IsOptional()
  @IsObject()
  summary?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alerts?: string[];
}
