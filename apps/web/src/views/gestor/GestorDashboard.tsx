'use client';

import { Card, Col, List, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { useGestorDashboard } from '@/hooks/useDashboardData';
import { useTranslation } from '@/providers/TranslationProvider';
import type { GestorDashboardData } from '@/types/dashboard';

const { Title } = Typography;

export default function GestorDashboard() {
  const { t } = useTranslation();
  const { data, isLoading } = useGestorDashboard();

  if (isLoading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const influencerColumns: ColumnsType<GestorDashboardData['pendingApprovals'][number]> = [
    {
      title: t('register.firstName'),
      dataIndex: 'firstName'
    },
    {
      title: t('register.lastName'),
      dataIndex: 'lastName'
    },
    {
      title: t('register.email'),
      dataIndex: 'email'
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY')
    }
  ];

  const campaignColumns: ColumnsType<GestorDashboardData['campaigns'][number]> = [
    {
      title: t('nav.campaigns'),
      dataIndex: 'name'
    },
    {
      title: 'Marca',
      dataIndex: 'brandName'
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (value: string) => <Tag color={value === 'active' ? 'success' : 'default'}>{value}</Tag>
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'startDate',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY')
    }
  ];

  const codeColumns: ColumnsType<GestorDashboardData['recentCodes'][number]> = [
    {
      title: 'Código',
      dataIndex: 'code'
    },
    {
      title: t('common.status'),
      dataIndex: 'status'
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm')
    }
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Title level={3}>{t('dashboard.gestor.title')}</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.shared.pendingApprovals')} value={data.stats.pendingInfluencers} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.gestor.influencersHeading')} value={data.stats.activeInfluencers} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.gestor.campaignsHeading')} value={data.stats.activeCampaigns} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.gestor.codesTitle')} value={data.stats.totalCodes} />
          </Card>
        </Col>
      </Row>

      <Card title={t('dashboard.gestor.approvalsTitle')}>
        <Table
          rowKey={(record) => record.id}
          columns={influencerColumns}
          dataSource={data.pendingApprovals}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={t('dashboard.gestor.campaignsHeading')}>
            <Table
              rowKey={(record) => record.id}
              columns={campaignColumns}
              dataSource={data.campaigns}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={t('dashboard.gestor.codesTitle')}>
            <Table
              rowKey={(record) => record.id}
              columns={codeColumns}
              dataSource={data.recentCodes}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Card title={t('common.notifications')}>
        <List
          dataSource={data.notifications}
          locale={{ emptyText: t('dashboard.shared.emptyState') }}
          renderItem={(item) => (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={item.type}
                description={dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}
