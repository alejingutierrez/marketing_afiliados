import { Injectable, UnauthorizedException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

import type { AuthenticatedUserPayload } from '../../common/interfaces/user.interface';
import { validatePasswordStrength } from '../../common/security/password-policy';

import type { AuthTokensDto } from './dto/auth-tokens.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { UpdatePasswordDto } from './dto/update-password.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UsersService } from './users.service';


@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async login({ email, password, twoFactorCode }: LoginDto): Promise<AuthTokensDto> {
    if (!email || !password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const normalizedEmail = email.toLowerCase();
    const user = this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecret) {
        throw new UnauthorizedException('Configuración 2FA inválida');
      }
      if (!twoFactorCode) {
        throw new UnauthorizedException('Se requiere código 2FA');
      }
      const tokenValid = authenticator.verify({ token: twoFactorCode, secret: user.twoFactorSecret });
      if (!tokenValid) {
        throw new UnauthorizedException('Código 2FA inválido');
      }
    }

    return this.generateTokens({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      tenantId: user.tenantId
    });
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<void> {
    const user = this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('La contraseña actual no es válida');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new UnauthorizedException('La nueva contraseña debe ser diferente a la actual');
    }

    const validation = validatePasswordStrength(dto.newPassword);
    if (!validation.valid) {
      throw new UnauthorizedException(`La contraseña no cumple la política: ${validation.errors.join(', ')}`);
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    this.usersService.updatePassword(userId, newHash);
  }

  async refreshToken({ refreshToken }: RefreshTokenDto): Promise<AuthTokensDto> {
    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUserPayload & { exp: number }>(
        refreshToken,
        {
          secret: this.configService.get<string>('jwt.refreshSecret')
        }
      );

      return this.generateTokens({
        sub: payload.sub,
        email: payload.email,
        roles: payload.roles,
        tenantId: payload.tenantId
      });
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  private async generateTokens(payload: AuthenticatedUserPayload): Promise<AuthTokensDto> {
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn', '3600s');
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn
      })
    ]);

    const expiresInSeconds = this.parseExpiresIn(accessExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds
    };
  }

  private parseExpiresIn(expiresIn: string): number {
    if (/^\d+$/.test(expiresIn)) {
      return parseInt(expiresIn, 10);
    }

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }
}
