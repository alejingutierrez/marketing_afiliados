'use client';

import { Alert, Checkbox, Divider, Form, Space, Spin, Typography } from 'antd';
import { useMemo } from 'react';

import { useTranslation } from '@/providers/TranslationProvider';
import type { PolicyVersion } from '@/types/policy';

interface PolicyConsentSectionProps {
  policy?: PolicyVersion | null;
  loading: boolean;
  error: boolean;
}

const { Text } = Typography;

export default function PolicyConsentSection({ policy, loading, error }: PolicyConsentSectionProps) {
  const { t, language } = useTranslation();

  const formattedDate = useMemo(() => {
    if (!policy?.publishedAt) {
      return t('register.policyUnknownDate');
    }
    const locale = language === 'en' ? 'en-US' : 'es-CO';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(policy.publishedAt));
  }, [language, policy, t]);

  return (
    <>
      <Divider orientation="left">{t('register.legalSection')}</Divider>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {loading ? <Spin size="small" /> : null}
        {error ? <Alert type="error" showIcon message={t('register.policiesLoadError')} /> : null}
        {!loading && !error && !policy ? (
          <Alert type="warning" showIcon message={t('register.policiesUnavailable')} />
        ) : null}
        {policy ? (
          <>
            <Text type="secondary">
              {t('register.policyMetadata', {
                date: formattedDate,
                checksum: policy.checksum
              })}
            </Text>
            <Form.Item
              name="policyAccepted"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
              rules={[
                {
                  validator: (_, value) =>
                    value
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('register.policyAcceptanceRequired')))
                }
              ]}
            >
              <Checkbox>
                <span>
                  {t('register.policiesLabel', { version: policy.version })}{' '}
                  <a href={policy.documentUrl} target="_blank" rel="noopener noreferrer">
                    {t('register.policyLink')}
                  </a>
                </span>
              </Checkbox>
            </Form.Item>
          </>
        ) : null}
      </Space>
    </>
  );
}
