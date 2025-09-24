import { Injectable, Optional } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ModuleRef } from '@nestjs/core';

import type { AuthenticatedUserPayload } from '../../../common/interfaces/user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly configService?: ConfigService;

  constructor(@Optional() configService: ConfigService, moduleRef: ModuleRef) {
    const resolvedConfig =
      configService ?? moduleRef?.get(ConfigService, { strict: false });
    const secret =
      resolvedConfig?.get<string>('jwt.accessSecret') ??
      process.env.JWT_ACCESS_SECRET ??
      'change-me-access';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret
    });

    this.configService = resolvedConfig;

    if (!resolvedConfig) {
      // eslint-disable-next-line no-console
      console.warn(
        'ConfigService not resolved for JwtStrategy; using environment fallback for JWT secret.'
      );
    }

    if (!secret || secret === 'change-me-access') {
      // eslint-disable-next-line no-console
      console.warn(
        'JwtStrategy using default development secret. Configure JWT_ACCESS_SECRET for stronger security.'
      );
    }
  }

  validate(payload: AuthenticatedUserPayload): AuthenticatedUserPayload {
    return payload;
  }
}
