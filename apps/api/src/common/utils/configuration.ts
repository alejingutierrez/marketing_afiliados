const parseVtexCredentials = () => {
  const raw = process.env.VTEX_CREDENTIALS;
  const credentials: { appKey: string; appToken: string; label?: string; expiresAt?: string }[] = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry && typeof entry === 'object' && entry.appKey && entry.appToken) {
            credentials.push({
              appKey: entry.appKey,
              appToken: entry.appToken,
              label: entry.label,
              expiresAt: entry.expiresAt
            });
          }
        }
      }
    } catch {
      // Ignored; fallback to individual env vars below.
    }
  }

  const primaryKey = process.env.VTEX_APP_KEY;
  const primaryToken = process.env.VTEX_APP_TOKEN;
  if (primaryKey && primaryToken && !credentials.some((item) => item.appKey === primaryKey && item.appToken === primaryToken)) {
    credentials.unshift({ appKey: primaryKey, appToken: primaryToken, label: 'primary' });
  }

  const secondaryKey = process.env.VTEX_SECONDARY_APP_KEY;
  const secondaryToken = process.env.VTEX_SECONDARY_APP_TOKEN;
  if (secondaryKey && secondaryToken) {
    credentials.push({ appKey: secondaryKey, appToken: secondaryToken, label: 'secondary' });
  }

  return credentials.length ? credentials : undefined;
};

const toNumberOrUndefined = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseRecipientList = (value?: string): string[] | undefined => {
  if (!value) {
    return undefined;
  }
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.length ? entries : undefined;
};

export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigins: process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()) || true,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '3600s',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'
  },
  vtex: {
    account: process.env.VTEX_ACCOUNT ?? '',
    environment: process.env.VTEX_ENVIRONMENT ?? 'production',
    appKey: process.env.VTEX_APP_KEY ?? '',
    appToken: process.env.VTEX_APP_TOKEN ?? '',
    baseUrl: process.env.VTEX_BASE_URL,
    timeoutMs: toNumberOrUndefined(process.env.VTEX_TIMEOUT_MS),
    maxRetries: toNumberOrUndefined(process.env.VTEX_MAX_RETRIES),
    retryDelayMs: toNumberOrUndefined(process.env.VTEX_RETRY_DELAY_MS),
    webhookSecret: process.env.VTEX_WEBHOOK_SECRET,
    defaultCurrency: process.env.VTEX_DEFAULT_CURRENCY ?? 'COP',
    includeShippingInEligible: process.env.VTEX_INCLUDE_SHIPPING === 'true',
    credentials: parseVtexCredentials()
  },
  mail: {
    enabled: process.env.MAIL_ENABLED !== 'false',
    transport: process.env.MAIL_TRANSPORT ?? 'smtp',
    from: process.env.MAIL_FROM ?? 'alerts@marketing-afiliados.local',
    recipients: {
      global: parseRecipientList(process.env.MAIL_ALERT_GLOBAL) ?? ['ops-alerts@medipiel.co'],
      finance: parseRecipientList(process.env.MAIL_ALERT_FINANCE),
      operations: parseRecipientList(process.env.MAIL_ALERT_OPERATIONS)
    },
    smtp: {
      host: process.env.MAIL_SMTP_HOST ?? 'mailhog',
      port: toNumberOrUndefined(process.env.MAIL_SMTP_PORT) ?? 1025,
      secure: process.env.MAIL_SMTP_SECURE === 'true',
      user: process.env.MAIL_SMTP_USER,
      pass: process.env.MAIL_SMTP_PASS
    }
  },
  metrics: {
    apiKey: process.env.METRICS_API_KEY,
    enabled: process.env.METRICS_ENABLED !== 'false'
  },
  telemetry: {
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'marketing-afiliados-api',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  },
  encryption: {
    dataKey: process.env.DATA_ENCRYPTION_KEY
  }
});
