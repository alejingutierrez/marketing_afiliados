import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class EvaluateTiersDto {
  @IsOptional()
  @IsISO8601()
  evaluationDate?: string;

  @IsOptional()
  @IsString()
  triggeredBy?: string;
}
