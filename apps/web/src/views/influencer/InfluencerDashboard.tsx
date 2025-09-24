'use client';

import { Card, Col, List, Progress, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { useInfluencerDashboard } from '@/hooks/useDashboardData';
import { useTranslation } from '@/providers/TranslationProvider';
import type { PaymentRecord, WithdrawalAdjustment, WithdrawalRequest } from '@/types/dashboard';

const { Title, Paragraph, Text } = Typography;

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

export default function InfluencerDashboard() {
  const { t } = useTranslation();
  const { data, isLoading } = useInfluencerDashboard();

  if (isLoading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const { metrics, balances, salesByCampaign, tierProgress, withdrawals, payments, adjustments, notifications } =
    data;

  const withdrawalColumns: ColumnsType<WithdrawalRequest> = [
    {
      title: t('common.createdAt'),
      dataIndex: 'requestedAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY')
    },
    {
      title: t('common.amount'),
      dataIndex: 'requestedAmount',
      render: (value: number) => currencyFormatter.format(value)
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (value: string) => <Tag color={statusColor(value)}>{value.toUpperCase()}</Tag>
    },
    {
      title: 'Ref',
      dataIndex: 'paymentReference'
    }
  ];

  const paymentColumns: ColumnsType<PaymentRecord> = [
    {
      title: t('common.createdAt'),
      dataIndex: 'paymentDate',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY')
    },
    {
      title: t('common.amount'),
      dataIndex: 'amount',
      render: (value: number) => currencyFormatter.format(value)
    },
    {
      title: 'Método',
      dataIndex: 'method'
    },
    {
      title: 'Referencia',
      dataIndex: 'reference'
    }
  ];

  const adjustmentsColumns: ColumnsType<WithdrawalAdjustment> = [
    {
      title: 'Tipo',
      dataIndex: 'type'
    },
    {
      title: t('common.amount'),
      dataIndex: 'amount',
      render: (value: number) => currencyFormatter.format(value)
    },
    {
      title: t('common.status'),
      dataIndex: 'status'
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updatedAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm')
    }
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Title level={3}>{t('dashboard.influencer.title')}</Title>
      <Row gutter={[16, 16]}> 
        <Col xs={24} md={6}>
          <MetricCard title={t('dashboard.influencer.commissionEstimated')} value={metrics.estimatedCommission} />
        </Col>
        <Col xs={24} md={6}>
          <MetricCard title={t('dashboard.influencer.commissionConfirmed')} value={metrics.confirmedCommission} />
        </Col>
        <Col xs={24} md={6}>
          <MetricCard title={t('dashboard.influencer.withdrawalsPending')} value={metrics.pendingWithdrawals} />
        </Col>
        <Col xs={24} md={6}>
          <MetricCard title={t('dashboard.influencer.paymentsTitle')} value={metrics.withdrawnAmount} />
        </Col>
      </Row>

      <Card title={t('dashboard.influencer.performanceHeading')}>
        <Row gutter={[16, 16]}>
          {salesByCampaign.length === 0 ? (
            <Col span={24}>
              <Paragraph type="secondary">{t('dashboard.shared.emptyState')}</Paragraph>
            </Col>
          ) : (
            salesByCampaign.map((campaign) => (
              <Col xs={24} md={8} key={campaign.campaignId}>
                <Card size="small" title={campaign.campaignName}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Text>{t('dashboard.influencer.commissionEstimated')}: {currencyFormatter.format(campaign.estimatedCommission)}</Text>
                    <Text>{t('dashboard.influencer.commissionConfirmed')}: {currencyFormatter.format(campaign.confirmedCommission)}</Text>
                    <Text>Ventas: {currencyFormatter.format(campaign.salesAmount)}</Text>
                    <Text>Pedidos: {campaign.orders}</Text>
                  </Space>
                </Card>
              </Col>
            ))
          )}
        </Row>
      </Card>

      <Card title={t('dashboard.influencer.nextTierProgress')}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {tierProgress.length === 0 ? (
            <Paragraph type="secondary">{t('dashboard.shared.emptyState')}</Paragraph>
          ) : (
            tierProgress.map((tier) => (
              <div key={tier.campaignId}>
                <Text strong>{tier.campaignName}</Text>
                <Progress percent={tier.progressPercentage} status="active" />
                <Text type="secondary">
                  {tier.nextTier
                    ? `${tier.salesVolume.toLocaleString()} / ${tier.nextThreshold?.toLocaleString()} COP`
                    : t('dashboard.influencer.tierMax') ?? 'Tier máximo alcanzado'}
                </Text>
              </div>
            ))
          )}
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={t('dashboard.influencer.withdrawalsTitle')}>
            <Table<WithdrawalRequest>
              columns={withdrawalColumns}
              dataSource={withdrawals}
              rowKey={(record) => record.id}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={t('dashboard.influencer.paymentsTitle')}>
            <Table<PaymentRecord>
              columns={paymentColumns}
              dataSource={payments}
              rowKey={(record) => record.id}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={t('dashboard.influencer.adjustmentsTitle')}>
            <Table<WithdrawalAdjustment>
              columns={adjustmentsColumns}
              dataSource={adjustments}
              rowKey={(record) => record.id}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={t('dashboard.shared.pendingApprovals')}>
            <List
              dataSource={notifications}
              locale={{ emptyText: t('dashboard.shared.emptyState') }}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={<Text>{item.type}</Text>}
                    description={dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {balances ? (
        <Card title={t('dashboard.influencer.balancesTitle')}>
          <Space size={24} wrap>
            <BalanceStat label={t('dashboard.influencer.commissionConfirmed')} value={balances.confirmedAmount} />
            <BalanceStat label={t('dashboard.influencer.withdrawalsTitle')} value={balances.withdrawnAmount} />
            <BalanceStat label={t('dashboard.influencer.withdrawalsPending')} value={balances.pendingWithdrawalAmount} />
            <BalanceStat label="Disponible" value={balances.availableForWithdrawal} highlight />
          </Space>
        </Card>
      ) : null}
    </Space>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <Statistic title={title} value={value} formatter={(val) => currencyFormatter.format(Number(val))} />
    </Card>
  );
}

function BalanceStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ minWidth: 180 }}>
      <Text type={highlight ? 'success' : undefined} strong>
        {label}
      </Text>
      <br />
      <Text>{currencyFormatter.format(value)}</Text>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'approved':
    case 'paid':
      return 'success';
    case 'pending':
      return 'processing';
    case 'rejected':
      return 'error';
    default:
      return 'default';
  }
}
