'use client';

import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Dropdown, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';

import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/providers/TranslationProvider';

const { Text } = Typography;

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const items: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <div>
          <Text strong>{user?.email ?? 'Usuario'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user?.roles.join(', ')}
          </Text>
        </div>
      ),
      disabled: true
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: t('common.logout'),
      icon: <LogoutOutlined />,
      onClick: () => logout()
    }
  ];

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
      <Space style={{ cursor: 'pointer' }}>
        <Avatar size="small" icon={<UserOutlined />} />
        <Text>{user?.firstName ?? user?.email ?? 'Usuario'}</Text>
      </Space>
    </Dropdown>
  );
}
