import { createHmac } from 'node:crypto';

import { VtexClient } from '@vtex-client';

describe('VTEX client helpers', () => {
  it('validates VTEX webhook signatures', () => {
    const secret = 'test-secret';
    const client = new VtexClient({
      account: 'medipiel',
      environment: 'production',
      appKey: '',
      appToken: '',
      webhookSecret: secret
    });

    const body = JSON.stringify({ orderId: '123' });
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    expect(client.verifyWebhookSignature({ 'x-vtex-hmac-sha256': signature }, body).valid).toBe(true);
    expect(client.verifyWebhookSignature({ 'x-vtex-hmac-sha256': 'invalid' }, body).valid).toBe(false);
  });

  it('persists coupon lifecycle in offline mode', async () => {
    const client = new VtexClient({
      account: 'medipiel',
      environment: 'production',
      appKey: '',
      appToken: ''
    });

    const coupon = await client.createOrUpdateCoupon({
      code: 'TEST-COUPON',
      discountPercent: 15,
      maxUsage: 5
    });

    expect(coupon.status).toBe('active');

    const deactivated = await client.deactivateCoupon('TEST-COUPON');
    expect(deactivated.status).toBe('inactive');
  });

  it('normalizes order payload extracting totals and categories', () => {
    const client = new VtexClient({
      account: 'medipiel',
      environment: 'production',
      appKey: '',
      appToken: ''
    });

    const mapped = client.mapOrderPayload({
      orderId: 'ORDER-1',
      status: 'paid',
      totalAmount: 10000,
      totals: [
        { id: 'Shipping', value: 1500 },
        { id: 'Tax', value: 500 }
      ],
      items: [
        {
          id: 'SKU-1',
          quantity: 2,
          price: 5000,
          additionalInfo: {
            categoriesIds: '/beauty/skincare'
          }
        }
      ]
    } as Record<string, unknown>);

    expect(mapped.shippingAmount).toBe(1500);
    expect(mapped.taxAmount).toBe(500);
    expect(mapped.items[0]?.categoryId).toBe('skincare');
  });
});
