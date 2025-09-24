import { IsISO8601, IsOptional, IsString, IsUrl } from 'class-validator';

export class PublishPolicyVersionDto {
  @IsString()
  version!: string;

  @IsUrl()
  documentUrl!: string;

  @IsString()
  checksum!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
