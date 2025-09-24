'use client';

import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import Link from 'next/link';

import { useThemePreferences } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/TranslationProvider';

const { Title, Paragraph, Text } = Typography;

export default function LandingPage() {
  const { t, list } = useTranslation();
  const { brand } = useThemePreferences();
  const benefits = list('landing.benefits');

  return (
    <div style={{ padding: '64px 32px' }}>
      <Row gutter={[48, 32]} align="middle" justify="center">
        <Col xs={24} md={12}>
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <Tag color="blue" style={{ width: 'fit-content' }}>
              {brand.name}
            </Tag>
            <Title level={1} style={{ margin: 0 }}>
              {t('landing.heroTitle')}
            </Title>
            <Paragraph style={{ fontSize: 18, marginBottom: 24 }}>
              {t('landing.heroSubtitle')}
            </Paragraph>
            <Space size="middle" wrap>
              <Link href="/register">
                <Button type="primary" size="large">
                  {t('landing.ctaPrimary')}
                </Button>
              </Link>
              <Link href="/login">
                <Button size="large">{t('landing.ctaSecondary')}</Button>
              </Link>
            </Space>
          </Space>
        </Col>
        <Col xs={24} md={12}>
          <Card title={t('landing.benefitsTitle')} bordered={false} style={{ boxShadow: '0 12px 32px rgba(15, 40, 80, 0.08)' }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {benefits.map((benefit, index) => (
                <Space key={benefit} align="start">
                  <Text strong style={{ color: brand.theme.token?.colorPrimary }}>
                    {index + 1}.
                  </Text>
                  <Text>{benefit}</Text>
                </Space>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
