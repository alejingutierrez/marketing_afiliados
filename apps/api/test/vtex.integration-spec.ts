import 'reflect-metadata';

import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import type { PolicyVersionRecord } from '../src/common/interfaces/policy.interface';
import { EncryptionService } from '../src/common/security/encryption.service';
import { InMemoryDatabaseService } from '../src/database/database.service';
import { AlertingService } from '../src/modules/notifications/alerting.service';
import { EmailService } from '../src/modules/notifications/email.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { VTEX_CLIENT } from '../src/modules/vtex/vtex.constants';
import { VtexService } from '../src/modules/vtex/vtex.service';
import { MetricsService } from '../src/observability/metrics.service';

import { MockEmailService } from './mocks/email.service.mock';
import { MockMetricsService } from './mocks/metrics.service.mock';
import { MockVtexClient } from './mocks/vtex-client.mock';

function buildConsent(policy: PolicyVersionRecord) {
  return {
    policyVersionId: policy.id,
    acceptedAt: new Date(),
    consentHash: `hash-${policy.id}`,
    ipAddress: '127.0.0.1',
    userAgent: 'jest'
  };
}

describe('VtexService integration', () => {
  let vtexService: VtexService;
  let database: InMemoryDatabaseService;
  let metrics: MockMetricsService;
  let email: MockEmailService;
  let mockClient: MockVtexClient;

  beforeEach(async () => {
    mockClient = new MockVtexClient();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ vtex: { includeShippingInEligible: true } })]
        })
      ],
      providers: [
        EncryptionService,
        InMemoryDatabaseService,
        NotificationsService,
        AlertingService,
        VtexService,
        { provide: VTEX_CLIENT, useValue: mockClient },
        { provide: MetricsService, useClass: MockMetricsService },
        { provide: EmailService, useClass: MockEmailService }
      ]
    }).compile();

    vtexService = moduleRef.get(VtexService);
    database = moduleRef.get(InMemoryDatabaseService);
    metrics = moduleRef.get(MetricsService) as unknown as MockMetricsService;
    email = moduleRef.get(EmailService) as unknown as MockEmailService;
  });

  it('sincroniza cupones y procesa webhooks actualizando comisiones y métricas', async () => {
    const policy = database.getActivePolicyVersionByType('terms');
    if (!policy) {
      throw new Error('terms policy not seeded');
    }

    const influencer = database.createInfluencer({
      tenantId: 'medipiel',
      firstName: 'Integración',
      lastName: 'VTEX',
      documentType: 'CC',
      documentNumber: `CC-${Date.now()}-VTEX`,
      email: `qa-vtex-${Date.now()}@example.com`,
      consent: buildConsent(policy)
    });
    database.updateInfluencerStatus({ influencerId: influencer.id, status: 'approved' });

    const campaign = database.createCampaign({
      tenantId: 'medipiel',
      brandId: 'qa-brand-int',
      brandName: 'QA Brand Integración',
      name: 'Campaña Integración',
      slug: `qa-campaign-int-${Date.now()}`,
      description: 'Campaña para pruebas de integración VTEX',
      startDate: new Date(),
      status: 'active',
      commissionBase: 15,
      commissionBasis: 'pre_tax',
      eligibleScopeType: 'category',
      eligibleScopeValues: ['skincare'],
      maxDiscountPercent: 25,
      maxUsage: 250
    });

    database.assignInfluencerToCampaign(influencer.id, campaign.id);

    const discount = database.createDiscountCode({
      tenantId: 'medipiel',
      campaignId: campaign.id,
      influencerId: influencer.id,
      prefix: 'INT',
      discountPercent: 15,
      maxUsage: 50
    });

    await vtexService.syncDiscountCode(discount.id);

    expect(mockClient.createCalls).toHaveLength(1);
    const storedDiscount = database.getDiscountCodeById(discount.id);
    expect(storedDiscount?.status).toBe('active');

    const created = await vtexService.handleOrderWebhook(
      {
        orderId: 'INT-ORDER-1',
        eventType: 'order-created',
        status: 'created',
        totalAmount: 180_000,
        currency: 'COP',
        couponCode: discount.code,
        shippingAmount: 5_000,
        taxAmount: 19_000,
        items: [
          {
            skuId: 'SKU-INT-1',
            quantity: 1,
            price: 180_000,
            categoryName: 'skincare'
          }
        ]
      },
      { signatureValid: true }
    );

    expect(created.commission?.state).toBe('ESTIMATED');
    expect(metrics.webhookCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'order-created', success: true })
      ])
    );

    await vtexService.handleOrderWebhook(
      {
        orderId: 'INT-ORDER-1',
        eventType: 'order-paid',
        status: 'paid',
        totalAmount: 180_000,
        currency: 'COP',
        couponCode: discount.code,
        items: created.order.items
      },
      { signatureValid: true }
    );

    expect(metrics.webhookCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'order-paid', success: true })
      ])
    );

    const confirmedCommission = database
      .listCommissions()
      .find((commission) => commission.orderId === 'INT-ORDER-1');
    expect(confirmedCommission?.state).toBe('CONFIRMED');

    mockClient.setDailyOrders([
      {
        orderId: 'INT-ORDER-EXTERNAL',
        status: 'paid',
        totalAmount: 90_000,
        currency: 'COP',
        couponCode: 'UNREGISTERED'
      }
    ]);

    const reconciliation = await vtexService.runDailyReconciliation(new Date(), {
      triggeredBy: 'qa',
      type: 'daily'
    });

    expect(reconciliation.discrepanciesFound).toBeGreaterThan(0);
    expect(metrics.reconciliationCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: reconciliation.discrepanciesFound })
      ])
    );
    expect(email.alerts.some((alert) => alert.category === 'reconciliation.alert')).toBe(true);
  });
});
