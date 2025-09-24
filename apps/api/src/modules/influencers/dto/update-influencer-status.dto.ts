import { IsEnum, IsOptional, IsString } from 'class-validator';

import type { InfluencerStatus } from '../../../common/interfaces/influencer.interface';

export class UpdateInfluencerStatusDto {
  @IsEnum(['pending', 'approved', 'rejected', 'suspended'])
  status!: InfluencerStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
