import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

import type { AuthenticatedUserPayload } from '../interfaces/user.interface';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUserPayload | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUserPayload | undefined;
  }
);
