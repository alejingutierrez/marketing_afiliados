export type AppRole =
  | 'admin_dentsu'
  | 'admin_marca'
  | 'gestor_afiliados'
  | 'finance'
  | 'auditor'
  | 'influencer';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  roles: AppRole[];
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
