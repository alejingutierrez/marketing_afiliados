'use client';

import { Layout, Menu, Space, Spin, Typography } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import BrandSelector from '@/components/layout/BrandSelector';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import NotificationBell from '@/components/layout/NotificationBell';
import UserMenu from '@/components/layout/UserMenu';
import { useAdminDashboard, useGestorDashboard, useInfluencerDashboard } from '@/hooks/useDashboardData';
import { getNavConfig, resolveActiveNavKey } from '@/lib/navigation';
import { ROUTE_TITLES } from '@/lib/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useLayoutState } from '@/providers/LayoutStateProvider';
import { useTranslation } from '@/providers/TranslationProvider';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { siderCollapsed, toggleSider } = useLayoutState();
  const influencerQuery = useInfluencerDashboard(user?.roles.includes('influencer') ? user.sub : undefined);
  const gestorQuery = useGestorDashboard();
  const adminQuery = useAdminDashboard();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  const availableNavItems = getNavConfig()
    .filter((item) => item.roles.some((role) => user.roles.includes(role)))
    .map((item) => ({
      key: item.key,
      label: item.labelKey,
      icon: item.icon,
      href: item.href
    }));

  const selectedKey = resolveActiveNavKey(pathname) ?? availableNavItems[0]?.key;

  const menuItems = availableNavItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: <Link href={item.href}>{t(item.labelKey)}</Link>
  }));

  const notifications: Parameters<typeof NotificationBell>[0]['items'] =
    influencerQuery.data?.notifications ??
    gestorQuery.data?.notifications ??
    adminQuery.data?.alerts ??
    [];

  const titleKey = ROUTE_TITLES[pathname]
    ? `nav.${ROUTE_TITLES[pathname].toLowerCase()}`
    : 'nav.dashboard';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={siderCollapsed}
        onCollapse={(collapsed) => toggleSider(collapsed)}
        width={240}
        style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ padding: '16px 24px' }}>
          <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
            Medipiel
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={menuItems}
          onClick={(info) => {
            const target = availableNavItems.find((item) => item.key === info.key);
            if (target) {
              router.push(target.href);
            }
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            {t(titleKey)}
          </Title>
          <Space size={16} align="center">
            <LanguageSwitcher />
            <BrandSelector />
            <NotificationBell items={notifications} />
            <UserMenu />
          </Space>
        </Header>
        <Content style={{ padding: '24px', background: '#f5f5f5' }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
