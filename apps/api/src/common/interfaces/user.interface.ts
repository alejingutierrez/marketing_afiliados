import type { AppRole } from './roles.enum';

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roles: AppRole[];
  tenantId: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
}

export interface AuthenticatedUserPayload {
  sub: string;
  email: string;
  roles: AppRole[];
  tenantId: string;
}
