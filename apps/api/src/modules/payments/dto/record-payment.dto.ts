import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested
} from 'class-validator';

import { WithdrawalDocumentDto } from './create-withdrawal-request.dto';

export class RecordPaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsString()
  @IsNotEmpty()
  method: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  voucherUrl?: string;

  @IsOptional()
  @IsNumber()
  taxWithheld?: number;

  @IsOptional()
  @IsString()
  reconciliationId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WithdrawalDocumentDto)
  documents?: WithdrawalDocumentDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adjustmentIds?: string[];
}

export class AddDocumentDto extends WithdrawalDocumentDto {}
