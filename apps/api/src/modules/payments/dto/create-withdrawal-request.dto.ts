import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested
} from 'class-validator';

import type { WithdrawalDocumentType } from '../../../common/interfaces/payment.interface';

const SUPPORTED_DOCUMENT_TYPES: WithdrawalDocumentType[] = [
  'withholding_certificate',
  'invoice',
  'transfer_receipt',
  'other'
];

export class WithdrawalDocumentDto {
  @IsString()
  @IsIn(SUPPORTED_DOCUMENT_TYPES)
  type: WithdrawalDocumentType;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateWithdrawalRequestDto {
  @IsUUID()
  influencerId: string;

  @IsString()
  @IsNotEmpty()
  brandId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WithdrawalDocumentDto)
  documents?: WithdrawalDocumentDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reconciliationIds?: string[];
}
