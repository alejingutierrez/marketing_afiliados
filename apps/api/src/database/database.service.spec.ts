import 'reflect-metadata';

import type { PolicyVersionRecord } from '../common/interfaces/policy.interface';
import { EncryptionService } from '../common/security/encryption.service';

import { InMemoryDatabaseService } from './database.service';

function createDatabase() {
  process.env.DATA_ENCRYPTION_KEY = 'qa-unit-test-secret-123456789012345678901234';
  const encryption = new EncryptionService();
  return new InMemoryDatabaseService(encryption);
}

function buildConsent(policy: PolicyVersionRecord) {
  return {
    policyVersionId: policy.id,
    acceptedAt: new Date(),
    consentHash: `hash-${policy.id}`,
    ipAddress: '127.0.0.1',
    userAgent: 'jest'
  };
}

describe('InMemoryDatabaseService', () => {
  it('transitions commissions from estimated to confirmed and updates balances', () => {
    const database = createDatabase();
    const policy = database.getActivePolicyVersionByType('terms');
    if (!policy) {
      throw new Error('terms policy not seeded');
    }

    const influencer = database.createInfluencer({
      tenantId: 'medipiel',
      firstName: 'Test',
      lastName: 'Influencer',
      documentType: 'CC',
      documentNumber: `CC-${Date.now()}`,
      email: `qa+${Date.now()}@example.com`,
      consent: buildConsent(policy)
    });

    database.updateInfluencerStatus({ influencerId: influencer.id, status: 'approved' });

    const campaign = database.createCampaign({
      tenantId: 'medipiel',
      brandId: 'qa-brand',
      brandName: 'QA Brand',
      name: 'Campaña QA',
      slug: `qa-campaign-${Date.now()}`,
      description: 'Campaña de prueba',
      startDate: new Date(),
      status: 'active',
      commissionBase: 12,
      commissionBasis: 'pre_tax',
      eligibleScopeType: 'category',
      eligibleScopeValues: ['skincare'],
      maxDiscountPercent: 20,
      maxUsage: 500
    });

    database.assignInfluencerToCampaign(influencer.id, campaign.id);

    const discount = database.createDiscountCode({
      tenantId: 'medipiel',
      campaignId: campaign.id,
      influencerId: influencer.id,
      prefix: 'QA',
      discountPercent: 15,
      maxUsage: 100
    });

    const created = database.registerOrderEvent({
      orderId: 'QA-ORDER-1',
      status: 'created',
      totalAmount: 150_000,
      currency: 'COP',
      couponCode: discount.code,
      items: [
        {
          skuId: 'SKU-QA-1',
          quantity: 1,
          price: 150_000,
          categoryName: 'skincare'
        }
      ],
      shippingAmount: 5_000,
      taxAmount: 19_500,
      includeShippingInEligible: true,
      eventType: 'order-created'
    });

    expect(created.commission?.state).toBe('ESTIMATED');

    const balanceAfterEstimate = database.getInfluencerBalance(influencer.id);
    expect(balanceAfterEstimate?.estimatedAmount).toBeGreaterThan(0);

    const estimatedAmount = balanceAfterEstimate?.estimatedAmount ?? 0;

    const paid = database.registerOrderEvent({
      orderId: 'QA-ORDER-1',
      status: 'paid',
      totalAmount: 150_000,
      currency: 'COP',
      couponCode: discount.code,
      items: created.order.items,
      shippingAmount: 5_000,
      taxAmount: 19_500,
      includeShippingInEligible: true,
      eventType: 'order-paid'
    });

    expect(paid.commission?.state).toBe('CONFIRMED');

    const balanceAfterConfirm = database.getInfluencerBalance(influencer.id);
    expect(balanceAfterConfirm?.estimatedAmount).toBe(0);
    expect(balanceAfterConfirm?.confirmedAmount).toBeCloseTo(estimatedAmount, 2);
    expect(balanceAfterConfirm?.availableForWithdrawal).toBeCloseTo(estimatedAmount, 2);
  });

  it('runSettlement confirms eligible commissions once waiting window is satisfied', () => {
    const database = createDatabase();
    const policy = database.getActivePolicyVersionByType('terms');
    if (!policy) {
      throw new Error('terms policy not seeded');
    }

    const influencer = database.createInfluencer({
      tenantId: 'medipiel',
      firstName: 'QA',
      lastName: 'Tester',
      documentType: 'CC',
      documentNumber: `CC-${Date.now()}-2`,
      email: `qa+settlement-${Date.now()}@example.com`,
      consent: buildConsent(policy)
    });

    database.updateInfluencerStatus({ influencerId: influencer.id, status: 'approved' });

    const campaign = database.createCampaign({
      tenantId: 'medipiel',
      brandId: 'qa-brand-b',
      brandName: 'QA Brand B',
      name: 'Campaña QA Settlement',
      slug: `qa-campaign-settlement-${Date.now()}`,
      description: 'Campaña de prueba settlement',
      startDate: new Date(),
      status: 'active',
      commissionBase: 20,
      commissionBasis: 'pre_tax',
      eligibleScopeType: 'category',
      eligibleScopeValues: ['skincare'],
      maxDiscountPercent: 25,
      maxUsage: 200
    });

    database.assignInfluencerToCampaign(influencer.id, campaign.id);

    const discount = database.createDiscountCode({
      tenantId: 'medipiel',
      campaignId: campaign.id,
      influencerId: influencer.id,
      prefix: 'SB',
      discountPercent: 20
    });

    const estimated = database.registerOrderEvent({
      orderId: 'QA-ORDER-SETTLEMENT',
      status: 'paid',
      totalAmount: 200_000,
      currency: 'COP',
      couponCode: discount.code,
      items: [
        {
          skuId: 'SKU-QA-SET',
          quantity: 1,
          price: 200_000,
          categoryName: 'skincare'
        }
      ],
      eventType: 'order-created'
    });

    expect(estimated.commission?.state).toBe('ESTIMATED');

    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const summary = database.runSettlement({ evaluationDate: futureDate, waitingPeriodDays: 15, triggeredBy: 'qa-test' });

    expect(summary.confirmed).toHaveLength(1);
    expect(summary.confirmed[0]?.commissionId).toBe(estimated.commission?.id);

    const commission = database.listCommissions().find((item) => item.id === estimated.commission?.id);
    expect(commission?.state).toBe('CONFIRMED');
    expect(commission?.confirmedAt).toBeDefined();

    const balance = database.getInfluencerBalance(influencer.id);
    expect(balance?.estimatedAmount).toBe(0);
    expect(balance?.confirmedAmount).toBeCloseTo(commission?.commissionAmount ?? 0, 2);
  });
});
