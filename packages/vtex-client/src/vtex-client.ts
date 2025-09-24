import { createHmac, timingSafeEqual } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import type {
  CouponResponse,
  CreateCouponInput,
  DailyReportResponse,
  DailyOrderSnapshot,
  OrderEventPayload,
  OrderItemPayload,
  ReconciliationInput,
  VtexClientConfig,
  VtexCredential,
  WebhookValidationResult
} from './models';

const DEFAULT_TIMEOUT = 5_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 250;
const VTEX_SIGNATURE_HEADER = 'x-vtex-hmac-sha256';
const FALLBACK_SIGNATURE_HEADER = 'x-vtex-signature';

interface HttpResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

interface HttpRequestInitLike {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

type HttpClientLike = (input: string, init?: HttpRequestInitLike) => Promise<HttpResponseLike>;

interface InternalCredential {
  appKey: string;
  appToken: string;
  label: string;
  expiresAt?: number;
}

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  retries?: number;
  expectText?: boolean;
}

export class VtexClient {
  private readonly account: string;

  private readonly environment: string;

  private readonly baseUrl?: string;

  private readonly timeoutMs: number;

  private readonly maxRetries: number;

  private readonly retryDelayMs: number;

  private readonly webhookSecret?: string;

  private readonly defaultCurrency: string;

  private readonly httpClient?: HttpClientLike;

  private readonly credentials: InternalCredential[];

  private credentialIndex = 0;

  private readonly offlineCoupons = new Map<string, CouponResponse>();

  constructor(config: VtexClientConfig) {
    this.account = config.account;
    this.environment = config.environment;
    this.baseUrl = this.resolveBaseUrl(config.baseUrl, config.account, config.environment);
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY;
    this.webhookSecret = config.webhookSecret;
    this.defaultCurrency = config.defaultCurrency ?? 'COP';
    this.httpClient = config.httpClient ?? this.resolveGlobalFetch();
    this.credentials = this.normalizeCredentials(config);

    if (!this.shouldUseRemote()) {
      this.bootstrapOfflineCoupons();
    }
  }

  async createOrUpdateCoupon(input: CreateCouponInput): Promise<CouponResponse> {
    if (!this.shouldUseRemote()) {
      const coupon = this.buildLocalCouponResponse(input, 'active');
      this.offlineCoupons.set(coupon.code.toUpperCase(), coupon);
      return coupon;
    }

    const payload = this.buildCouponPayload(input);
    const response = await this.request<unknown>('POST', '/api/rnb/pvt/coupon', {
      body: payload,
      idempotencyKey: `coupon-${input.code}`
    });

    return this.normalizeCouponResponse(response, input, 'active');
  }

  async activateCoupon(code: string): Promise<CouponResponse> {
    return this.updateCouponStatus(code, 'activate');
  }

  async deactivateCoupon(code: string): Promise<CouponResponse> {
    return this.updateCouponStatus(code, 'deactivate');
  }

  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookValidationResult {
    if (!this.webhookSecret) {
      return { valid: true, reason: 'secret-not-configured' };
    }

    const provided = this.extractSignature(headers);
    if (!provided) {
      return { valid: false, reason: 'signature-header-missing' };
    }

    const computed = this.computeSignature(rawBody);
    const isValid = this.safeCompare(provided, computed);

    return {
      valid: isValid,
      reason: isValid ? undefined : 'signature-mismatch',
      providedSignature: provided,
      expectedSignature: computed
    };
  }

  mapOrderPayload(payload: Record<string, unknown>): OrderEventPayload {
    const marketingData = this.asRecord(payload.marketingData);
    const totals = Array.isArray(payload.totals) ? (payload.totals as Record<string, unknown>[]) : [];
    const shippingAmount = this.resolveAmountFromTotals(totals, 'Shipping');
    const taxAmount = this.resolveAmountFromTotals(totals, 'Tax');

    const items = this.normalizeItems(payload.items);

    return {
      orderId: this.resolveOrderId(payload),
      eventType: (payload.eventType as OrderEventPayload['eventType']) ?? 'order-created',
      status: (payload.status as OrderEventPayload['status']) ??
        (payload.currentState as OrderEventPayload['status']) ??
        'created',
      totalAmount: this.resolveNumber(payload.totalAmount ?? payload.value ?? payload.totalValue ?? payload.orderValue),
      currency: typeof payload.currency === 'string' ? payload.currency : this.defaultCurrency,
      couponCode:
        this.resolveString(payload.coupon) ??
        this.resolveString(marketingData?.coupon) ??
        this.resolveString(payload.couponCode),
      shippingAmount,
      taxAmount,
      items,
      rawPayload: payload
    };
  }

  buildReconciliationInput(payload: Record<string, unknown>): ReconciliationInput {
    const summary = this.asRecord(payload.summary) ?? this.asRecord(payload.payload) ?? undefined;
    const alerts = Array.isArray(summary?.alerts)
      ? (summary.alerts as unknown[]).map((item) => this.resolveString(item) ?? '').filter(Boolean)
      : undefined;

    return {
      runDate: payload.runDate ? new Date(payload.runDate as string) : new Date(),
      type: (typeof payload.type === 'string' ? payload.type : 'daily') as ReconciliationInput['type'],
      discrepanciesFound: this.resolveNumber(payload.discrepanciesFound),
      reportUrl: this.resolveString(payload.reportUrl) ?? undefined,
      summary,
      alerts
    };
  }

  async fetchDailyReport(date: Date): Promise<DailyReportResponse> {
    if (!this.shouldUseRemote()) {
      return {
        runDate: date,
        orders: [],
        rawPayload: { source: 'offline' }
      };
    }

    const isoDate = this.toDateOnlyIso(date);
    const data = await this.request<unknown>('GET', '/api/oms/pvt/orders', {
      query: {
        f_creationDate: isoDate,
        per_page: 100
      }
    });

    return this.normalizeDailyReport(data, date);
  }

  private async updateCouponStatus(code: string, intent: 'activate' | 'deactivate'): Promise<CouponResponse> {
    if (!this.shouldUseRemote()) {
      const existing = this.offlineCoupons.get(code.toUpperCase());
      const coupon = existing ?? this.buildLocalCouponResponse({ code }, intent === 'activate' ? 'active' : 'inactive');
      coupon.status = intent === 'activate' ? 'active' : 'inactive';
      this.offlineCoupons.set(coupon.code.toUpperCase(), coupon);
      return coupon;
    }

    const path = `/api/rnb/pvt/coupon/${encodeURIComponent(code)}/${intent}`;
    const response = await this.request<unknown>('POST', path, {
      body: {},
      idempotencyKey: `coupon-${intent}-${code}`
    });

    return this.normalizeCouponResponse(response, { code }, intent === 'activate' ? 'active' : 'inactive');
  }

  private async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    if (!this.baseUrl || !this.httpClient || this.credentials.length === 0) {
      throw new Error('VTEX client is running in offline mode and cannot perform HTTP requests');
    }

    const url = this.composeUrl(path, options.query);
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= (options.retries ?? this.maxRetries)) {
      const credential = this.pickCredential();
      try {
        const response = await this.executeHttp(url, method, options, credential);
        if (response.status === 401 || response.status === 403) {
          this.rotateCredential();
          lastError = await this.buildHttpError(response, url);
        } else if ((response.status >= 500 || response.status === 429) && attempt < (options.retries ?? this.maxRetries)) {
          lastError = await this.buildHttpError(response, url);
          await delay(this.retryDelayMs);
        } else if (!response.ok) {
          throw await this.buildHttpError(response, url);
        } else {
          return (await this.parseResponse<T>(response, options.expectText)) as T;
        }
      } catch (error) {
        lastError = error;
        if (attempt >= (options.retries ?? this.maxRetries)) {
          break;
        }
        await delay(this.retryDelayMs);
      }
      attempt += 1;
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('VTEX request failed without specific error details');
  }

  private async executeHttp(url: string, method: string, options: RequestOptions, credential: InternalCredential) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-VTEX-API-AppKey': credential.appKey,
      'X-VTEX-API-AppToken': credential.appToken,
      ...options.headers
    };

    if (options.idempotencyKey) {
      headers['X-Idempotency-Key'] = options.idempotencyKey;
    }

    const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;

    const requestPromise = this.httpClient!(url, {
      method,
      headers,
      body
    });

    return await this.resolveWithTimeout(requestPromise);
  }

  private async resolveWithTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`VTEX request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs).unref();
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async parseResponse<T>(response: HttpResponseLike, expectText?: boolean): Promise<T> {
    const contentType = response.headers.get('content-type');
    if (expectText || !contentType || !contentType.includes('json')) {
      return (await response.text()) as unknown as T;
    }

    return (await response.json()) as T;
  }

  private async buildHttpError(response: HttpResponseLike, url: string) {
    const payload = await this.safeReadBody(response);
    const error = new Error(`VTEX request failed (${response.status} ${response.statusText}) for ${url}`);
    (error as Error & { details?: unknown }).details = payload;
    return error;
  }

  private async safeReadBody(response: HttpResponseLike) {
    try {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch {
      return undefined;
    }
  }

  private composeUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const normalizedPath = path.startsWith('http')
      ? path
      : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    const url = new URL(normalizedPath);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private pickCredential(): InternalCredential {
    if (this.credentials.length === 0) {
      throw new Error('VTEX credentials are not configured');
    }

    const now = Date.now();
    for (let offset = 0; offset < this.credentials.length; offset += 1) {
      const index = (this.credentialIndex + offset) % this.credentials.length;
      const candidate = this.credentials[index];
      if (!candidate.expiresAt || candidate.expiresAt > now) {
        this.credentialIndex = index;
        return candidate;
      }
    }

    throw new Error('All VTEX credentials are expired');
  }

  private rotateCredential() {
    if (this.credentials.length <= 1) {
      return;
    }

    this.credentialIndex = (this.credentialIndex + 1) % this.credentials.length;
  }

  private shouldUseRemote(): boolean {
    return Boolean(this.baseUrl && this.httpClient && this.credentials.length > 0);
  }

  private resolveBaseUrl(baseUrl: string | undefined, account: string, environment: string): string | undefined {
    if (baseUrl) {
      return baseUrl.replace(/\/$/, '');
    }

    if (!account) {
      return undefined;
    }

    const host = this.resolveEnvironmentHost(environment);
    return host ? `https://${account}.${host}` : undefined;
  }

  private resolveEnvironmentHost(environment: string): string | undefined {
    if (!environment) {
      return undefined;
    }

    if (environment.includes('.')) {
      return environment.replace(/\/$/, '');
    }

    switch (environment) {
      case 'production':
        return 'myvtex.com';
      case 'stable':
        return 'vtexcommercestable.com';
      default:
        return environment;
    }
  }

  private resolveGlobalFetch(): HttpClientLike | undefined {
    const candidate = (globalThis as Record<string, unknown>).fetch;
    if (typeof candidate === 'function') {
      return candidate.bind(globalThis) as HttpClientLike;
    }

    return undefined;
  }

  private normalizeCredentials(config: VtexClientConfig): InternalCredential[] {
    const pool: VtexCredential[] = [];

    if (config.credentials?.length) {
      pool.push(...config.credentials);
    } else if (config.appKey && config.appToken) {
      pool.push({ appKey: config.appKey, appToken: config.appToken, label: 'primary' });
    }

    return pool
      .filter((credential) => Boolean(credential.appKey) && Boolean(credential.appToken))
      .map((credential, index) => ({
        appKey: credential.appKey,
        appToken: credential.appToken,
        label: credential.label ?? `credential-${index + 1}`,
        expiresAt: credential.expiresAt
          ? new Date(credential.expiresAt).getTime()
          : undefined
      }));
  }

  private bootstrapOfflineCoupons() {
    const now = new Date();
    const demo: CouponResponse = {
      id: 'VTEX-DEMO',
      code: 'DEMO-COUPON',
      status: 'active',
      discountPercent: 10,
      maxUsage: 100,
      startsAt: now,
      expiresAt: new Date(now.getTime() + 86_400_000)
    };
    this.offlineCoupons.set(demo.code.toUpperCase(), demo);
  }

  private buildLocalCouponResponse(input: CreateCouponInput, status: CouponResponse['status']): CouponResponse {
    const now = new Date();
    const existing = this.offlineCoupons.get(input.code.toUpperCase());
    return {
      id: existing?.id ?? `VTEX-${input.code}`,
      code: input.code,
      status,
      discountPercent: input.discountPercent ?? existing?.discountPercent,
      maxUsage: input.maxUsage ?? existing?.maxUsage,
      maxUsagePerClient: input.maxUsagePerClient ?? existing?.maxUsagePerClient,
      startsAt: input.startsAt ?? existing?.startsAt ?? now,
      expiresAt: input.expiresAt ?? existing?.expiresAt,
      campaignId: input.campaignId ?? existing?.campaignId,
      influencerId: input.influencerId ?? existing?.influencerId,
      metadata: input.metadata ?? existing?.metadata
    };
  }

  private buildCouponPayload(input: CreateCouponInput) {
    return {
      couponCode: input.code,
      isActive: input.isActive ?? true,
      maxNumberOfUses: input.maxUsage,
      maxNumberOfUsesPerCustomer: input.maxUsagePerClient,
      beginDate: input.startsAt?.toISOString(),
      expirationDate: input.expiresAt?.toISOString(),
      discount: input.discountPercent,
      campaignId: input.campaignId,
      influencerId: input.influencerId,
      tradePolicyId: input.tradePolicyId,
      metadata: input.metadata
    };
  }

  private normalizeCouponResponse(response: unknown, fallback: CreateCouponInput, status: CouponResponse['status']): CouponResponse {
    if (!response || typeof response !== 'object') {
      return this.buildLocalCouponResponse(fallback, status);
    }

    const payload = response as Record<string, unknown>;

    const id = this.resolveString(payload.id ?? payload.Id ?? payload.couponId) ?? `VTEX-${fallback.code}`;
    const normalizedStatus = this.resolveCouponStatus(payload.status) ?? status;

    return {
      id,
      code: this.resolveString(payload.code ?? payload.couponCode) ?? fallback.code,
      status: normalizedStatus,
      discountPercent: this.resolveNumber(payload.discount ?? payload.discountPercent ?? fallback.discountPercent),
      maxUsage: this.resolveNumber(payload.maxNumberOfUses ?? payload.maxUsage ?? fallback.maxUsage),
      maxUsagePerClient: this.resolveNumber(payload.maxNumberOfUsesPerCustomer ?? payload.maxUsagePerCustomer ?? fallback.maxUsagePerClient),
      startsAt: this.resolveDate(payload.beginDate ?? payload.startsAt) ?? fallback.startsAt,
      expiresAt: this.resolveDate(payload.expirationDate ?? payload.expiresAt) ?? fallback.expiresAt,
      campaignId: this.resolveString(payload.campaignId) ?? fallback.campaignId,
      influencerId: this.resolveString(payload.influencerId) ?? fallback.influencerId,
      tradePolicyId: this.resolveString(payload.tradePolicyId) ?? fallback.tradePolicyId,
      metadata: this.asRecord(payload.metadata) ?? fallback.metadata,
      rawPayload: response
    };
  }

  private normalizeItems(rawItems: unknown): OrderItemPayload[] {
    if (!Array.isArray(rawItems)) {
      return [];
    }

    return rawItems.map((entry) => {
      const item = this.asRecord(entry) ?? {};
      const seller = this.asRecord(item.seller) ?? {};
      const additionalInfo = this.asRecord(item.additionalInfo) ?? {};
      const priceDefinition = this.asRecord(item.priceDefinition) ?? {};
      const categoriesIds = typeof additionalInfo.categoriesIds === 'string'
        ? additionalInfo.categoriesIds.split('/')
        : undefined;

      return {
        skuId: this.resolveString(item.id ?? item.skuId ?? item.refId) ?? '',
        skuRef: this.resolveString(item.refId ?? item.skuRef ?? seller.sku)
          ?? undefined,
        quantity: this.resolveNumber(item.quantity ?? 0),
        price: this.resolveNumber(item.price ?? item.sellingPrice ?? item.value ?? 0),
        listPrice: this.resolveNumber(item.listPrice),
        discount: this.resolveNumber(item.discount ?? priceDefinition.totalDiscount),
        taxAmount: this.resolveNumber(item.tax ?? item.taxValue ?? item.totalTax),
        categoryId: categoriesIds?.at(-1) ?? this.resolveString(item.productCategoryIds),
        categoryName: this.resolveString(item.productCategoryName ?? item.category)
      };
    });
  }

  private normalizeDailyReport(response: unknown, date: Date): DailyReportResponse {
    if (!response || typeof response !== 'object') {
      return { runDate: date, orders: [], rawPayload: response };
    }

    const payload = response as Record<string, unknown>;
    const list = Array.isArray(payload.list) ? payload.list : Array.isArray(payload.data) ? payload.data : [];

    const orders: DailyOrderSnapshot[] = list.map((entry) => {
      const record = this.asRecord(entry) ?? {};
      return {
        orderId: this.resolveString(record.orderId ?? record.id ?? record.sequence) ?? '',
        status: (record.status as DailyOrderSnapshot['status']) ?? 'created',
        totalAmount: this.resolveNumber(record.totalAmount ?? record.value ?? record.totalValue),
        currency: this.resolveString(record.currency) ?? this.defaultCurrency,
        couponCode: this.resolveString(record.coupon ?? record.couponCode),
        lastChange: this.resolveDate(record.lastChange ?? record.creationDate)
      };
    });

    return {
      runDate: date,
      orders,
      rawPayload: response
    };
  }

  private computeSignature(rawBody: string): string {
    return createHmac('sha256', this.webhookSecret ?? '').update(rawBody, 'utf8').digest('hex');
  }

  private extractSignature(headers: Record<string, string | string[] | undefined>): string | undefined {
    const headerValue = headers[VTEX_SIGNATURE_HEADER] ?? headers[FALLBACK_SIGNATURE_HEADER];
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }

    return headerValue ?? undefined;
  }

  private safeCompare(provided: string, expected: string): boolean {
    try {
      const providedBuffer = Buffer.from(provided, 'hex');
      const expectedBuffer = Buffer.from(expected, 'hex');
      if (providedBuffer.length !== expectedBuffer.length) {
        return false;
      }
      return timingSafeEqual(providedBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  private resolveOrderId(payload: Record<string, unknown>): string {
    const candidates = [payload.orderId, payload.id, payload.sequence, payload.orderName];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return `order-${Date.now()}`;
  }

  private resolveAmountFromTotals(totals: Record<string, unknown>[], type: string): number | undefined {
    const match = totals.find((total) => this.resolveString(total.id) === type);
    if (!match) {
      return undefined;
    }

    return this.resolveNumber(match.value ?? match.amount ?? match.total);
  }

  private resolveCouponStatus(status: unknown): CouponResponse['status'] | undefined {
    if (typeof status !== 'string') return undefined;
    const normalized = status.toLowerCase();
    if (normalized.includes('inactive') || normalized.includes('disabled')) {
      return 'inactive';
    }
    if (normalized.includes('pending')) {
      return 'pending';
    }
    if (normalized.includes('active') || normalized.includes('enabled')) {
      return 'active';
    }
    return undefined;
  }

  private resolveString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    return undefined;
  }

  private resolveNumber(value: unknown): number {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  private resolveDate(value: unknown): Date | undefined {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return undefined;
  }

  private toDateOnlyIso(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    return value as Record<string, unknown>;
  }
}
