import { IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RunSettlementDto {
  @IsOptional()
  @IsISO8601()
  evaluationDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  waitingPeriodDays?: number;

  @IsOptional()
  @IsString()
  triggeredBy?: string;
}
