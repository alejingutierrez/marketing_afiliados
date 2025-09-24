'use client';

import { Card, Col, Row, Space, Spin, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { useFinanceDashboard } from '@/hooks/useDashboardData';
import { useTranslation } from '@/providers/TranslationProvider';
import type { FinanceDashboardData, PaymentRecord, WithdrawalAdjustment, WithdrawalRequest } from '@/types/dashboard';

const { Title, Text } = Typography;

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

export default function FinanceDashboard() {
  const { t } = useTranslation();
  const { data, isLoading } = useFinanceDashboard();

  if (isLoading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const withdrawalColumns: ColumnsType<WithdrawalRequest> = [
    {
      title: t('common.createdAt'),
      dataIndex: 'requestedAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY')
    },
    {
      title: 'Influencer',
      dataIndex: 'influencerId'
    },
    {
      title: 'Marca',
      dataIndex: 'brandName'
    },
    {
      title: t('common.amount'),
      dataIndex: 'requestedAmount',
      render: (value: number) => currencyFormatter.format(value)
    },
    {
      title: t('common.status'),
      dataIndex: 'status'
    }
  ];

  const paymentColumns: ColumnsType<PaymentRecord> = [
    {
      title: t('common.createdAt'),
      dataIndex: 'paymentDate',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY')
    },
    {
      title: 'Influencer',
      dataIndex: 'influencerId'
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
      title: 'Influencia',
      dataIndex: 'influencerId'
    },
    {
      title: t('common.amount'),
      dataIndex: 'amount',
      render: (value: number) => currencyFormatter.format(value)
    },
    {
      title: t('common.status'),
      dataIndex: 'status'
    }
  ];

  const totals = computeTotals(data);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Title level={3}>{t('dashboard.finance.title')}</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.finance.confirmedBalance')} value={currencyFormatter.format(totals.confirmedBalance)} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.finance.pendingBalance')} value={currencyFormatter.format(totals.pendingWithdrawals)} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.finance.todaysRequests')} value={totals.todayRequests} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('dashboard.finance.pendingAdjustments')} value={totals.pendingAdjustments} />
          </Card>
        </Col>
      </Row>

      <Card title={t('dashboard.finance.withdrawalsQueue')}>
        <Table
          rowKey={(record) => record.id}
          columns={withdrawalColumns}
          dataSource={data.withdrawals}
          pagination={{ pageSize: 7 }}
          size="small"
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={t('dashboard.finance.paymentsHistory')}>
            <Table
              rowKey={(record) => record.id}
              columns={paymentColumns}
              dataSource={data.payments}
              pagination={{ pageSize: 7 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={t('dashboard.finance.pendingAdjustments')}>
            <Table
              rowKey={(record) => record.id}
              columns={adjustmentsColumns}
              dataSource={data.adjustments}
              pagination={{ pageSize: 7 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Card title={t('dashboard.finance.reconciliations')}>
        <Table
          rowKey={(record) => record.id}
          columns={reconciliationColumns}
          dataSource={data.reconciliations}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>

      <Card title="Políticas por marca">
        <Row gutter={[16, 16]}>
          {data.policies.map((policy) => (
            <Col xs={24} md={8} key={policy.brandId}>
              <Card size="small">
                <Text strong>{policy.brandName}</Text>
                <br />
                <Text type="secondary">
                  {currencyFormatter.format(policy.minimumAmount)} · {policy.waitingPeriodDays ?? 0} días
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </Space>
  );
}

const reconciliationColumns: ColumnsType<FinanceDashboardData['reconciliations'][number]> = [
  {
    title: 'Fecha',
    dataIndex: 'runDate',
    render: (value: string) => dayjs(value).format('DD/MM/YYYY')
  },
  {
    title: 'Tipo',
    dataIndex: 'type'
  },
  {
    title: 'Discrepancias',
    dataIndex: 'discrepanciesFound'
  }
];

function computeTotals(data: FinanceDashboardData) {
  const confirmedBalance = data.balances.reduce((acc, balance) => acc + balance.confirmedAmount, 0);
  const pendingWithdrawals = data.withdrawals
    .filter((withdrawal) => withdrawal.status === 'pending')
    .reduce((acc, withdrawal) => acc + withdrawal.requestedAmount, 0);
  const todayRequests = data.withdrawals.filter((withdrawal) =>
    dayjs(withdrawal.requestedAt).isSame(new Date(), 'day')
  ).length;
  const pendingAdjustments = data.adjustments.filter((adjustment) => adjustment.status === 'pending').length;

  return {
    confirmedBalance,
    pendingWithdrawals,
    todayRequests,
    pendingAdjustments
  };
}
