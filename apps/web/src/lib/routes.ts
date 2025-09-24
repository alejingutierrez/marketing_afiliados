import type { AppRole } from '@/types/auth';

export function getDefaultDashboardPath(roles: AppRole[]): string {
  if (roles.includes('admin_dentsu') || roles.includes('auditor')) {
    return '/dashboard/admin';
  }
  if (roles.includes('finance')) {
    return '/dashboard/finance';
  }
  if (roles.includes('gestor_afiliados') || roles.includes('admin_marca')) {
    return '/dashboard/gestor';
  }
  if (roles.includes('influencer')) {
    return '/dashboard/influencer';
  }
  return '/dashboard';
}

export const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/influencer': 'Influencer',
  '/dashboard/gestor': 'Gestión',
  '/dashboard/finance': 'Finanzas',
  '/dashboard/admin': 'Administración'
};
