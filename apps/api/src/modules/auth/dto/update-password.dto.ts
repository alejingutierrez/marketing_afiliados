import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  newPassword!: string;
}
