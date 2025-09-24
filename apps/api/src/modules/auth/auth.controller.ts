import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUserPayload } from '../../common/interfaces/user.interface';
import { validateDto } from '../../common/utils/validate-dto';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuthService } from './auth.service';
import type { AuthTokensDto } from './dto/auth-tokens.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@ApiTags('auth')
@Controller({ path: 'auth' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() payload: unknown): Promise<AuthTokensDto> {
    const dto = validateDto(LoginDto, payload);
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() payload: unknown): Promise<AuthTokensDto> {
    const dto = validateDto(RefreshTokenDto, payload);
    return this.authService.refreshToken(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async profile(@CurrentUser() user: AuthenticatedUserPayload) {
    return user;
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async changePassword(@CurrentUser() user: AuthenticatedUserPayload, @Body() payload: unknown) {
    const dto = validateDto(UpdatePasswordDto, payload);
    await this.authService.updatePassword(user.sub, dto);
    return { message: 'Contraseña actualizada' };
  }
}
