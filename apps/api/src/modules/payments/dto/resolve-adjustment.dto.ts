import { IsIn, IsOptional, IsString } from 'class-validator';

import type { WithdrawalAdjustmentResolutionType } from '../../../common/interfaces/payment.interface';

const ALLOWED_RESOLUTION_TYPES: WithdrawalAdjustmentResolutionType[] = ['recovered', 'written_off'];

export class ResolveAdjustmentDto {
  @IsIn(ALLOWED_RESOLUTION_TYPES)
  resolutionType: WithdrawalAdjustmentResolutionType;

  @IsOptional()
  @IsString()
  notes?: string;
}
