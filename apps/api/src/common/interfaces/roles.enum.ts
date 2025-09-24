export enum AppRole {
  ADMIN_DENTSU = 'admin_dentsu',
  ADMIN_MARCA = 'admin_marca',
  GESTOR_AFILIADOS = 'gestor_afiliados',
  FINANCE = 'finance',
  AUDITOR = 'auditor',
  INFLUENCER = 'influencer'
}

export const PRIVILEGED_ROLES = [
  AppRole.ADMIN_DENTSU,
  AppRole.ADMIN_MARCA,
  AppRole.GESTOR_AFILIADOS
];
