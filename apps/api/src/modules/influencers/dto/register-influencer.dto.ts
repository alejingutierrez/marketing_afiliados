import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class RegisterInfluencerDocumentDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsOptional()
  @IsString()
  base64Content?: string;

  @IsOptional()
  @IsString()
  checksum?: string;
}

export class RegisterInfluencerDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @IsEmail()
  email!: string;

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
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  socialLinks?: string[];

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

  @IsString()
  @IsNotEmpty()
  policyVersionId!: string;

  @IsString()
  @IsNotEmpty()
  consentHash!: string;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterInfluencerDocumentDto)
  documents?: RegisterInfluencerDocumentDto[];
}
