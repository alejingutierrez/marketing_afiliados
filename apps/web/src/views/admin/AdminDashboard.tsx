'use client';

import { Card, Col, List, Row, Space, Spin, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { useAdminDashboard } from '@/hooks/useDashboardData';
import { useTranslation } from '@/providers/TranslationProvider';
import type { AdminDashboardData } from '@/types/dashboard';

const { Title } = Typography;

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminDashboard();

  if (isLoading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const topInfluencersColumns: ColumnsType<AdminDashboardData['topInfluencers'][number]> = [
    { title: 'Influencer', dataIndex: 'name' },
    {
      title: t('dashboard.influencer.commissionConfirmed'),
      dataIndex: 'confirmedCommission',
      render: (value: number) => currencyFormatter.format(value)
    },
    {
      title: t('dashboard.influencer.commissionEstimated'),
      dataIndex: 'estimatedCommission',
      render: (value: number) => currencyFormatter.format(value)
    }
  ];

  const performanceColumns: ColumnsType<AdminDashboardData['performanceByBrand'][number]> = [
    { title: 'Marca', dataIndex: 'brandName' },
    {
      title: 'Ventas atribuidas',
      dataIndex: 'totalSales',
      render: (value: number) => currencyFormatter.format(value)
    },
    {
      title: t('dashboard.influencer.commissionConfirmed'),
      dataIndex: 'confirmedCommission',
      render: (value: number) => currencyFormatter.format(value)
    }
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Title level={3}>{t('dashboard.admin.title')}</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.admin.kpiInfluencers')} value={data.stats.influencers} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.admin.kpiBrands')} value={data.stats.brands} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.admin.kpiCommissions')} value={currencyFormatter.format(data.stats.confirmedCommission)} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.admin.kpiConversion')} value={computeConversionRate(data)} suffix="%" precision={2} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Top influencers">
            <Table
              rowKey={(record) => record.influencerId}
              columns={topInfluencersColumns}
              dataSource={data.topInfluencers}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Performance por marca">
            <Table
              rowKey={(record) => record.brandId}
              columns={performanceColumns}
              dataSource={data.performanceByBrand}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Alertas recientes">
            <List
              dataSource={data.alerts}
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
        </Col>
        <Col xs={24} md={12}>
          <Card title="Auditoría de comisiones">
            <List
              dataSource={data.auditTrail}
              locale={{ emptyText: t('dashboard.shared.emptyState') }}
              renderItem={(entry) => (
                <List.Item key={entry.id}>
                  <List.Item.Meta
                    title={`${entry.previousState ?? 'N/A'} → ${entry.nextState}`}
                    description={dayjs(entry.changedAt).format('DD/MM/YYYY HH:mm')}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title={t('dashboard.finance.reconciliations')}>
        <List
          dataSource={data.recentReconciliations}
          renderItem={(item) => (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={`${item.type.toUpperCase()} · ${t('dashboard.finance.reconciliations')}`}
                description={`${dayjs(item.runDate).format('DD/MM/YYYY')} · ${item.discrepanciesFound} discrepancias`}
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}

function computeConversionRate(data: AdminDashboardData): number {
  const totalSales = data.performanceByBrand.reduce((acc, item) => acc + item.totalSales, 0);
  if (!totalSales) {
    return 0;
  }
  const confirmed = data.performanceByBrand.reduce((acc, item) => acc + item.confirmedCommission, 0);
  return (confirmed / totalSales) * 100;
}
