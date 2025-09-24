import { IsOptional, IsString } from 'class-validator';

export class UpdateInfluencerDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  bankAccount?: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    accountType?: string;
  };

  @IsOptional()
  @IsString()
  taxProfile?: string;
}
