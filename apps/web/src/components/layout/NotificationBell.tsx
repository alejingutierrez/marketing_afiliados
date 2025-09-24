'use client';

import { BellOutlined } from '@ant-design/icons';
import { Badge, Dropdown, List, Typography } from 'antd';

export interface NotificationItem {
  id: string;
  type: string;
  recipient: string;
  createdAt: string | Date;
  payload?: Record<string, unknown>;
}

interface NotificationBellProps {
  items: NotificationItem[];
}

const { Text } = Typography;

export default function NotificationBell({ items }: NotificationBellProps) {
  const count = items.length;

  const content = (
    <div style={{ width: 320, maxHeight: 360, overflowY: 'auto' }}>
      <List
        dataSource={items}
        locale={{ emptyText: 'Sin notificaciones' }}
        renderItem={(item) => {
          const createdAt = typeof item.createdAt === 'string'
            ? new Date(item.createdAt)
            : item.createdAt;
          return (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={<Text strong>{item.type}</Text>}
                description={createdAt.toLocaleString()}
              />
            </List.Item>
          );
        }}
      />
    </div>
  );

  return (
    <Dropdown placement="bottomRight" trigger={['click']} dropdownRender={() => content}>
      <Badge count={count} size="small" overflowCount={9}>
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
      </Badge>
    </Dropdown>
  );
}
