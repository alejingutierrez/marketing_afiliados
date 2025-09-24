'use client';

import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getDefaultDashboardPath } from '@/lib/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/providers/TranslationProvider';

const { Title, Paragraph, Text } = Typography;

interface LoginForm {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login, status, user, isAuthenticating, error } = useAuth();
  const [form] = Form.useForm<LoginForm>();
  const [formError, setFormError] = useState<string | null>(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && user) {
      const destination = getDefaultDashboardPath(user.roles);
      router.replace(destination);
    }
  }, [router, status, user]);

  const handleSubmit = async (values: LoginForm) => {
    setFormError(null);
    try {
      const profile = await login(values.email, values.password, values.twoFactorCode);
      setTwoFactorRequired(false);
      form.resetFields(['twoFactorCode']);
      const destination = getDefaultDashboardPath(profile.roles);
      router.replace(destination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      if (message.toLowerCase().includes('2fa')) {
        setTwoFactorRequired(true);
        form.setFieldsValue({ twoFactorCode: '' });
      }
      setFormError(message);
    }
  };

  const displayError = formError ?? error;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 16px' }}>
      <Card style={{ maxWidth: 420, width: '100%', boxShadow: '0 12px 32px rgba(15, 40, 80, 0.08)' }}>
        <Title level={3}>{t('auth.loginTitle')}</Title>
        <Paragraph type="secondary">{t('auth.loginSubtitle')}</Paragraph>
        <Form<LoginForm> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            label={t('auth.email')}
            name="email"
            rules={[{ required: true, message: t('register.email') }]}
          >
            <Input type="email" autoComplete="email" allowClear size="large" disabled={isAuthenticating} />
          </Form.Item>
          <Form.Item
            label={t('auth.password')}
            name="password"
            rules={[{ required: true, message: t('auth.password') }]}
          >
            <Input.Password autoComplete="current-password" size="large" disabled={isAuthenticating} />
          </Form.Item>
          <Form.Item
            label={t('auth.twoFactorCode') ?? 'Código 2FA'}
            name="twoFactorCode"
            hidden={!twoFactorRequired}
            rules={
              twoFactorRequired
                ? [
                    { required: true, message: t('auth.twoFactorRequired') ?? 'Ingresa el código 2FA' },
                    { len: 6, message: t('auth.twoFactorLength') ?? 'Debe tener 6 dígitos' }
                  ]
                : []
            }
          >
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              disabled={isAuthenticating}
              autoComplete="one-time-code"
            />
          </Form.Item>
          {displayError ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              message={displayError}
              showIcon
            />
          ) : null}
          <Button type="primary" htmlType="submit" block size="large" loading={isAuthenticating}>
            {t('auth.submit')}
          </Button>
        </Form>
        <Paragraph style={{ marginTop: 24 }}>
          <Text type="secondary">{t('auth.noAccount')} </Text>
          <Link href="/register">{t('auth.register')}</Link>
        </Paragraph>
      </Card>
    </div>
  );
}
