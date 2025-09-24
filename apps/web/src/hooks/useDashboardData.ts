'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import type { AppRole } from '@/types/auth';
import type {
  AdminDashboardData,
  FinanceDashboardData,
  GestorDashboardData,
  InfluencerDashboardData
} from '@/types/dashboard';

const dashboardKey = {
  influencer: (id?: string) => ['dashboard', 'influencer', id] as const,
  gestor: ['dashboard', 'gestor'] as const,
  finance: ['dashboard', 'finance'] as const,
  admin: ['dashboard', 'admin'] as const
};

function hasAnyRole(userRoles: AppRole[], roles: AppRole[]) {
  return roles.some((role) => userRoles.includes(role));
}

export function useInfluencerDashboard(influencerId?: string) {
  const { request, user } = useAuth();
  const targetId = influencerId ?? user?.sub;
  const enabled = Boolean(targetId) && Boolean(user);

  return useQuery({
    queryKey: dashboardKey.influencer(targetId ?? 'me'),
    queryFn: () =>
      request<InfluencerDashboardData>(
        targetId ? `/dashboard/influencer?influencerId=${targetId}` : '/dashboard/influencer'
      ),
    enabled
  });
}

export function useGestorDashboard() {
  const { request, user } = useAuth();
  const enabled = Boolean(user) && hasAnyRole(user.roles, ['admin_dentsu', 'gestor_afiliados', 'admin_marca']);

  return useQuery({
    queryKey: dashboardKey.gestor,
    queryFn: () => request<GestorDashboardData>('/dashboard/gestor'),
    enabled
  });
}

export function useFinanceDashboard() {
  const { request, user } = useAuth();
  const enabled = Boolean(user) && hasAnyRole(user.roles, ['admin_dentsu', 'finance']);

  return useQuery({
    queryKey: dashboardKey.finance,
    queryFn: () => request<FinanceDashboardData>('/dashboard/finance'),
    enabled
  });
}

export function useAdminDashboard() {
  const { request, user } = useAuth();
  const enabled = Boolean(user) && hasAnyRole(user.roles, ['admin_dentsu', 'auditor']);

  return useQuery({
    queryKey: dashboardKey.admin,
    queryFn: () => request<AdminDashboardData>('/dashboard/admin'),
    enabled
  });
}
