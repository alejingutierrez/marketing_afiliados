export interface VtexCredential {
  appKey: string;
  appToken: string;
  label?: string;
  expiresAt?: Date | string;
}

export interface VtexClientConfig {
  account: string;
  environment: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  webhookSecret?: string;
  defaultCurrency?: string;
  appKey?: string;
  appToken?: string;
  credentials?: VtexCredential[];
  httpClient?: typeof fetch;
}

export interface CreateCouponInput {
  code: string;
  discountPercent?: number;
  maxUsage?: number;
  maxUsagePerClient?: number;
  startsAt?: Date;
  expiresAt?: Date;
  campaignId?: string;
  influencerId?: string;
  tradePolicyId?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CouponResponse {
  id: string;
  code: string;
  status: 'active' | 'inactive' | 'pending';
  maxUsage?: number;
  maxUsagePerClient?: number;
  discountPercent?: number;
  startsAt?: Date;
  expiresAt?: Date;
  campaignId?: string;
  influencerId?: string;
  tradePolicyId?: string;
  metadata?: Record<string, unknown>;
  rawPayload?: unknown;
}

export interface OrderItemPayload {
  skuId: string;
  skuRef?: string;
  quantity: number;
  price: number;
  listPrice?: number;
  discount?: number;
  taxAmount?: number;
  categoryId?: string;
  categoryName?: string;
}

export interface OrderEventPayload {
  orderId: string;
  eventType: 'order-created' | 'order-paid' | 'order-canceled';
  status: 'created' | 'paid' | 'invoiced' | 'shipped' | 'canceled' | 'returned';
  totalAmount: number;
  currency: string;
  couponCode?: string;
  shippingAmount?: number;
  taxAmount?: number;
  eligibleAmount?: number;
  items: OrderItemPayload[];
  rawPayload?: unknown;
}

export interface ReconciliationInput {
  runDate: Date;
  type: 'daily' | 'fortnightly' | 'adhoc';
  discrepanciesFound: number;
  reportUrl?: string;
  summary?: Record<string, unknown>;
  alerts?: string[];
}

export interface WebhookValidationResult {
  valid: boolean;
  reason?: string;
  providedSignature?: string;
  expectedSignature?: string;
}

export interface DailyOrderSnapshot {
  orderId: string;
  status: OrderEventPayload['status'];
  totalAmount: number;
  currency: string;
  couponCode?: string;
  lastChange?: Date;
}

export interface DailyReportResponse {
  runDate: Date;
  orders: DailyOrderSnapshot[];
  rawPayload?: unknown;
}
