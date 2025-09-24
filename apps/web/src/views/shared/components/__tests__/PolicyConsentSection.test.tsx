import { render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import PolicyConsentSection from '@/views/shared/components/PolicyConsentSection';

vi.mock('@/providers/TranslationProvider', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'register.legalSection': 'Consentimientos legales',
        'register.policiesLoadError': 'Error cargando políticas',
        'register.policiesUnavailable': 'Política no disponible',
        'register.policyMetadata': 'Vigente desde {{date}} · checksum {{checksum}}',
        'register.policyUnknownDate': 'fecha pendiente',
        'register.policyAcceptanceRequired': 'Debe aceptar las políticas',
        'register.policiesLabel': 'Acepto la versión {{version}}',
        'register.policyLink': 'Ver documento'
      };
      const template = translations[key] ?? key;
      if (!vars) {
        return template;
      }
      return template.replace(/{{\s*([^}]+)\s*}}/g, (_, token) => {
        const value = vars[token.trim()];
        return value !== undefined ? String(value) : '';
      });
    },
    list: () => [],
    raw: () => undefined,
    language: 'es',
    setLanguage: vi.fn()
  })
}));

beforeAll(() => {
  if (!window.matchMedia) {
    // @ts-expect-error - jsdom does not implement matchMedia
    window.matchMedia = () => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    });
  }
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PolicyConsentSection', () => {
  it('renders loading indicator', () => {
    const { container } = render(
      <Form>
        <PolicyConsentSection loading policy={null} error={false} />
      </Form>
    );

    expect(container.querySelector('.ant-spin')).not.toBeNull();
  });

  it('shows warning when no policy is available', () => {
    render(
      <Form>
        <PolicyConsentSection loading={false} error={false} policy={null} />
      </Form>
    );

    expect(screen.getByText('Política no disponible')).toBeInTheDocument();
  });

  it('renders acceptance checkbox with metadata when policy is present', () => {
    render(
      <Form>
        <PolicyConsentSection
          loading={false}
          error={false}
          policy={{
            id: 'terms-v1',
            policyType: 'terms',
            version: '1.0.0',
            documentUrl: 'https://example.com/terms',
            checksum: 'sha256:terms-v1-demo',
            publishedAt: '2024-01-15T12:00:00.000Z',
            isActive: true
          }}
        />
      </Form>
    );

    expect(screen.getByText(/sha256:terms-v1-demo/i)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: /versión 1\.0\.0/i
      })
    ).toBeInTheDocument();
  });
});
