'use client';

import { PaperClipOutlined } from '@ant-design/icons';
import { Button, Card, Col, Divider, Form, Input, Result, Row, Select, Space, Typography, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useMemo, useState } from 'react';

import { useActivePolicies } from '@/hooks/usePolicies';
import { sha256 } from '@/lib/hash';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation } from '@/providers/TranslationProvider';
import PolicyConsentSection from '@/views/shared/components/PolicyConsentSection';

const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PP', label: 'Pasaporte' }
];

const ACCOUNT_TYPES = [
  { value: 'ahorros', label: 'Ahorros' },
  { value: 'corriente', label: 'Corriente' }
];

interface RegisterFormValues {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxProfile?: string;
  socialLinks?: string[];
  bankAccount?: {
    accountHolder?: string;
    bankName?: string;
    accountNumber?: string;
    accountType?: string;
  };
  policyAccepted?: boolean;
}

interface PreparedDocument {
  filename: string;
  contentType: string;
  base64Content: string;
  checksum?: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function RegisterPage() {
  const [form] = Form.useForm<RegisterFormValues>();
  const { t } = useTranslation();
  const { request } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadFile[]>([]);
  const {
    data: policies,
    isLoading: loadingPolicies,
    isError: policiesError
  } = useActivePolicies();
  const termsPolicy = useMemo(
    () => policies?.find((policy) => policy.policyType === 'terms'),
    [policies]
  );
  const socialLinksRules = useMemo(
    () => [{ type: 'url' as const, message: 'Debe ingresar una URL válida' }],
    []
  );

  const handleUploadChange = async ({ file, fileList }: { file: UploadFile; fileList: UploadFile[] }) => {
    if (file.status === 'removed') {
      setUploadedFiles(fileList);
      return;
    }

    if (file.originFileObj) {
      const base64 = await fileToBase64(file.originFileObj);
      file.response = base64;
    }

    setUploadedFiles(fileList);
  };

  const prepareDocuments = (): PreparedDocument[] => {
    return uploadedFiles
      .filter((file) => Boolean(file.response))
      .map((file) => ({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Content: String(file.response ?? ''),
        checksum: undefined
      }));
  };

  const handleSubmit = async (values: RegisterFormValues) => {
    setSubmitting(true);
    setSuccess(false);

    try {
      if (!termsPolicy) {
        message.error(t('register.policyUnavailable'));
        return;
      }
      const { policyAccepted: _policyAccepted, socialLinks, ...rest } = values;
      const policyVersionId = termsPolicy.id;
      const consentHash = await sha256(`${values.email}|${policyVersionId}|${Date.now()}`);
      const documents = prepareDocuments();
      const payload = {
        ...rest,
        policyVersionId,
        consentHash,
        socialLinks: socialLinks?.filter(Boolean),
        documents,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined
      };

      await request('/public/influencers', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, { skipAuth: true });

      setSuccess(true);
      message.success(t('register.successTitle'));
      form.resetFields();
      setUploadedFiles([]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 16px' }}>
        <Result
          status="success"
          title={t('register.successTitle')}
          subTitle={t('register.successDescription')}
          extra={(
            <Button type="primary" onClick={() => setSuccess(false)}>
              {t('common.continue')}
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 16px' }}>
      <Card style={{ maxWidth: 960, width: '100%', boxShadow: '0 12px 32px rgba(15, 40, 80, 0.08)' }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3}>{t('register.title')}</Typography.Title>
            <Typography.Paragraph type="secondary">{t('register.subtitle')}</Typography.Paragraph>
          </div>

          <Form<RegisterFormValues>
            layout="vertical"
            form={form}
            requiredMark
            initialValues={{ policyAccepted: false }}
            onFinish={handleSubmit}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('register.firstName')}
                  name="firstName"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="Laura" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('register.lastName')}
                  name="lastName"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="Gómez" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Form.Item
                  label={t('register.documentType')}
                  name="documentType"
                  rules={[{ required: true }]}
                >
                  <Select options={DOCUMENT_TYPES} placeholder="CC" />
                </Form.Item>
              </Col>
              <Col xs={24} md={16}>
                <Form.Item
                  label={t('register.documentNumber')}
                  name="documentNumber"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="1032456789" />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">{t('register.contactInfo')}</Divider>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('register.email')}
                  name="email"
                  rules={[{ required: true }, { type: 'email' }]}
                >
                  <Input type="email" placeholder="persona@medipiel.co" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('register.phone')} name="phone">
                  <Input placeholder="3001234567" />
                </Form.Item>
              </Col>
            </Row>

            <Form.List name="socialLinks">
              {(fields, { add, remove }) => (
                <div>
                  <Typography.Text strong>{t('register.socialLinks')}</Typography.Text>
                  <Space direction="vertical" style={{ width: '100%' }} size={8}> 
                    {fields.map((field) => (
                      <Space key={field.key} align="baseline">
                        <Form.Item
                          {...field}
                          rules={socialLinksRules}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="https://instagram.com/mi_perfil" style={{ minWidth: 320 }} />
                        </Form.Item>
                        <Button type="link" onClick={() => remove(field.name)}>
                          {t('common.remove') ?? 'Eliminar'}
                        </Button>
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add()}>
                      + {t('common.add') ?? 'Agregar enlace'}
                    </Button>
                  </Space>
                </div>
              )}
            </Form.List>

            <Divider orientation="left">{t('register.residency')}</Divider>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Form.Item label={t('register.address')} name="address">
                  <Input placeholder="Calle 123 #45-67" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label={t('register.city')} name="city">
                  <Input placeholder="Bogotá" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label={t('register.country')} name="country">
                  <Input placeholder="Colombia" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label={t('register.taxProfile')} name="taxProfile">
              <Input placeholder="Régimen simplificado" />
            </Form.Item>

            <Divider orientation="left">{t('register.bankInfo')}</Divider>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Form.Item label={t('register.bankAccountHolder')} name={['bankAccount', 'accountHolder']}>
                  <Input placeholder="Titular de la cuenta" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('register.bankName')} name={['bankAccount', 'bankName']}>
                  <Input placeholder="Bancolombia" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('register.bankAccountNumber')} name={['bankAccount', 'accountNumber']}>
                  <Input placeholder="000123456789" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('register.bankAccountType')} name={['bankAccount', 'accountType']}>
                  <Select allowClear options={ACCOUNT_TYPES} placeholder="Selecciona" />
                </Form.Item>
              </Col>
            </Row>

            <PolicyConsentSection policy={termsPolicy} loading={loadingPolicies} error={policiesError} />

            <Divider orientation="left">{t('register.documents')}</Divider>

            <Upload.Dragger
              multiple
              fileList={uploadedFiles}
              accept=".pdf,.jpg,.jpeg,.png"
              beforeUpload={() => false}
              onChange={handleUploadChange}
              onRemove={(file) => {
                setUploadedFiles((prev) => prev.filter((item) => item.uid !== file.uid));
              }}
            >
              <p className="ant-upload-drag-icon">
                <PaperClipOutlined style={{ fontSize: 24 }} />
              </p>
              <p className="ant-upload-text">Arrastra o haz clic para adjuntar soportes opcionales.</p>
            </Upload.Dragger>

            <Divider />

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={submitting}
              disabled={loadingPolicies || !termsPolicy}
            >
              {t('register.submit')}
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
