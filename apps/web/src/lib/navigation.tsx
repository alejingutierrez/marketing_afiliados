import { BarChartOutlined, DashboardOutlined, DollarCircleOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/hooks/useItems';
import type { ReactNode } from 'react';

import type { AppRole } from '@/types/auth';

export interface NavItem {
  key: string;
  href: string;
  labelKey: string;
  roles: AppRole[];
  icon: ReactNode;
}

const BASE_ITEMS: NavItem[] = [
  {
    key: 'dashboard-home',
    href: '/dashboard',
    labelKey: 'nav.dashboard',
    roles: ['admin_dentsu', 'gestor_afiliados', 'finance', 'admin_marca', 'auditor', 'influencer'],
    icon: <DashboardOutlined />
  },
  {
    key: 'dashboard-influencer',
    href: '/dashboard/influencer',
    labelKey: 'nav.influencer',
    roles: ['influencer', 'admin_dentsu', 'gestor_afiliados'],
    icon: <UserOutlined />
  },
  {
    key: 'dashboard-gestor',
    href: '/dashboard/gestor',
    labelKey: 'nav.gestor',
    roles: ['admin_dentsu', 'gestor_afiliados', 'admin_marca'],
    icon: <TeamOutlined />
  },
  {
    key: 'dashboard-finance',
    href: '/dashboard/finance',
    labelKey: 'nav.finance',
    roles: ['admin_dentsu', 'finance'],
    icon: <DollarCircleOutlined />
  },
  {
    key: 'dashboard-admin',
    href: '/dashboard/admin',
    labelKey: 'nav.admin',
    roles: ['admin_dentsu', 'auditor'],
    icon: <BarChartOutlined />
  }
];

export function getNavItemsForRoles(roles: AppRole[]): ItemType[] {
  const allowedRoles = new Set<AppRole>(roles);
  const items = BASE_ITEMS.filter((item) => item.roles.some((role) => allowedRoles.has(role)));

  return items.map<ItemType>((item) => ({
    key: item.key,
    label: item.labelKey,
    icon: item.icon,
    onClick: undefined
  }));
}

export function resolveActiveNavKey(pathname: string): string | undefined {
  const entry = BASE_ITEMS.find((item) => pathname.startsWith(item.href));
  return entry?.key;
}

export function getNavConfig() {
  return BASE_ITEMS;
}

export const NAV_ITEMS = BASE_ITEMS;
