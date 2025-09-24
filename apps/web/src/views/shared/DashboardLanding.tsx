'use client';

import { Card, Typography } from 'antd';

import { useTranslation } from '@/providers/TranslationProvider';

const { Title, Paragraph } = Typography;

export default function DashboardLanding() {
  const { t } = useTranslation();
  return (
    <Card>
      <Title level={3}>{t('nav.dashboard')}</Title>
      <Paragraph>
        Selecciona la vista correspondiente a tu rol desde el menú lateral. Próximamente encontrarás accesos
        rápidos y métricas combinadas en este espacio.
      </Paragraph>
    </Card>
  );
}
