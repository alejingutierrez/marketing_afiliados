import { IsIn, IsOptional, IsString } from 'class-validator';

const ALLOWED_STATUSES = ['approved', 'rejected'] as const;
export type WithdrawalDecisionStatus = (typeof ALLOWED_STATUSES)[number];

export class DecideWithdrawalDto {
  @IsIn(ALLOWED_STATUSES)
  status: WithdrawalDecisionStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}
