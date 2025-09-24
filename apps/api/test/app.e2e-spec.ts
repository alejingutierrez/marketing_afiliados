import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { authenticator } from 'otplib';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('API foundation (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  const twoFactorSecret = "JBSWY3DPEHPK3PXP";
  let createdInfluencerId: string;
  let campaignId: string;
  let brandId: string;
  let discountCodeValue: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('auth/login should return tokens for default admin', async () => {
    const twoFactorCode = authenticator.generate(twoFactorSecret);
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@medipiel.co',
        password: 'changeit',
        twoFactorCode
      });

    expect(loginResponse.status).toBe(200);

    expect(loginResponse.body.accessToken).toBeDefined();
    expect(loginResponse.body.refreshToken).toBeDefined();
    accessToken = loginResponse.body.accessToken;
  });

  it('enforces password policy when updating password', async () => {
    const weakResponse = await request(app.getHttpServer())
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'changeit',
        newPassword: 'weakpass'
      });

    expect(weakResponse.status).toBe(401);
    expect(weakResponse.body.message || weakResponse.body.error).toBeDefined();

    const strongPassword = 'Stronger!2024Pass';
    const updateResponse = await request(app.getHttpServer())
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'changeit',
        newPassword: strongPassword
      });

    expect(updateResponse.status).toBe(200);

    const legacyLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@medipiel.co',
        password: 'changeit',
        twoFactorCode: authenticator.generate(twoFactorSecret)
      });

    expect(legacyLogin.status).toBe(401);

    const refreshedTwoFactor = authenticator.generate(twoFactorSecret);
    const loginWithNewPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@medipiel.co',
        password: strongPassword,
        twoFactorCode: refreshedTwoFactor
      });

    expect(loginWithNewPassword.status).toBe(200);
    accessToken = loginWithNewPassword.body.accessToken;
  });

  it('registers a new influencer', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/influencers')
      .send({
        firstName: 'Laura',
        lastName: 'Gomez',
        documentType: 'CC',
        documentNumber: `DOC-${Date.now()}`,
        email: `laura${Date.now()}@example.com`,
        phone: '3001234567',
        policyVersionId: 'terms-v1',
        consentHash: 'hash-example-123',
        userAgent: 'vitest-e2e'
      });

    expect(response.status).toBe(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.status).toBe('pending');
    createdInfluencerId = response.body.id;
  });

  it('exposes active policy versions publicly', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/public/policies')
      .expect(200);

    expect(Array.isArray(listResponse.body)).toBe(true);
    const termsPolicy = listResponse.body.find((policy: { id: string }) => policy.id === 'terms-v1');
    expect(termsPolicy).toBeDefined();
    expect(termsPolicy.policyType).toBe('terms');

    const singleResponse = await request(app.getHttpServer())
      .get('/api/v1/public/policies/terms')
      .expect(200);

    expect(singleResponse.body.id).toBe('terms-v1');
    expect(singleResponse.body.version).toBeDefined();
  });

  it('returns consent history and certificates for an influencer', async () => {
    const historyResponse = await request(app.getHttpServer())
      .get(`/api/v1/policies/consents/${createdInfluencerId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(historyResponse.body)).toBe(true);
    const consent = historyResponse.body[0];
    expect(consent.policyVersionId).toBeDefined();
    expect(consent.acceptedAt).toBeDefined();

    const certificateResponse = await request(app.getHttpServer())
      .get(`/api/v1/policies/consents/${createdInfluencerId}/${consent.policyVersionId}/certificate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(certificateResponse.body.certificateId).toBeDefined();
    expect(certificateResponse.body.policy.id).toBe(consent.policyVersionId);
  });

  it('publishes a new policy version and notifies stakeholders', async () => {
    const publishResponse = await request(app.getHttpServer())
      .post('/api/v1/policies/terms/versions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        version: '1.0.1',
        documentUrl: 'https://policies.medipiel.com/terms/v1-0-1',
        checksum: 'sha256:terms-v1-0-1'
      });

    expect([200, 201]).toContain(publishResponse.status);
    expect(publishResponse.body.version).toBe('1.0.1');

    const notificationsAfterPublish = await request(app.getHttpServer())
      .get('/api/v1/notifications/pending')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const policyNotification = notificationsAfterPublish.body.find((event: { type: string }) => event.type === 'policy.updated');
    expect(policyNotification).toBeDefined();
  });

  it('lists influencers when user has privileged role', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/influencers')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    expect(Array.isArray(res.body)).toBe(true);

    type InfluencerResponse = {
      id: string;
      status: string;
      email?: string;
      bankAccount?: { accountNumber?: string; last4?: string };
    };

    const influencers = res.body as InfluencerResponse[];
    expect(influencers.some((item) => item.id === createdInfluencerId)).toBe(true);
    const demoInfluencer = influencers.find((item) => item.email === 'influencer@medipiel.co');
    if (demoInfluencer?.bankAccount) {
      expect(demoInfluencer.bankAccount.accountNumber ?? '').toMatch(/\*/);
      if (demoInfluencer.bankAccount.last4) {
        expect(demoInfluencer.bankAccount.last4.length).toBe(4);
      }
    }
  });

  it('approves influencer to enable VTEX coupon syncing', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/influencers/${createdInfluencerId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'approved' })
      .expect(200);

    expect(res.body.status).toBe('approved');
  });

  it('assigns influencer to campaign and generates VTEX coupon', async () => {
    const campaignsResponse = await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(campaignsResponse.body)).toBe(true);
    campaignId = campaignsResponse.body[0]?.id;
    expect(campaignId).toBeDefined();
    brandId = campaignsResponse.body[0]?.brandId;
    expect(brandId).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/influencers/${createdInfluencerId}/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const codeResponse = await request(app.getHttpServer())
      .post('/api/v1/codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        campaignId,
        influencerId: createdInfluencerId,
        prefix: 'TEST',
        discountPercent: 10,
        maxUsage: 50
      })
      .expect(201);

    expect(codeResponse.body.id).toBeDefined();
    expect(codeResponse.body.vtexCouponId).toBeDefined();
    expect(codeResponse.body.status).toBe('active');
    discountCodeValue = codeResponse.body.code;
  });

  it('processes VTEX order webhook events and records reconciliation', async () => {
    orderId = `ORDER-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/vtex/webhooks/orders')
      .send({
        orderId,
        eventType: 'order-created',
        status: 'created',
        totalAmount: 250000,
        currency: 'COP',
        couponCode: discountCodeValue,
        items: [
          {
            skuId: 'SKU1',
            quantity: 1,
            price: 250000,
            categoryName: 'skincare'
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/vtex/webhooks/orders')
      .send({
        orderId,
        eventType: 'order-paid',
        status: 'paid',
        totalAmount: 250000,
        currency: 'COP',
        couponCode: discountCodeValue,
        items: [
          {
            skuId: 'SKU1',
            quantity: 1,
            price: 250000,
            categoryName: 'skincare'
          }
        ]
      })
      .expect(201);

    const ordersResponse = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(ordersResponse.body)).toBe(true);
    const recordedOrder = ordersResponse.body[0];
    expect(recordedOrder?.eligibleAmount).toBe(250000);

    const commissionsResponse = await request(app.getHttpServer())
      .get('/api/v1/commissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(commissionsResponse.body)).toBe(true);
    const commission = commissionsResponse.body[0];
    expect(commission?.state).toBe('CONFIRMED');
    expect(commission?.commissionAmount).toBe(25000);
    expect(commission?.tierName).toBeDefined();
    expect(commission?.commissionRate).toBeGreaterThan(0);

    const autoReconciliation = await request(app.getHttpServer())
      .post('/api/v1/vtex/reconciliations/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ date: new Date().toISOString(), type: 'daily' })
      .expect(201);

    expect(autoReconciliation.body.discrepanciesFound).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(autoReconciliation.body.alerts ?? [])).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/vtex/reconciliations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        runDate: new Date().toISOString(),
        type: 'daily',
        discrepanciesFound: 0
      })
      .expect(201);

    const reconciliationResponse = await request(app.getHttpServer())
      .get('/api/v1/commissions/reconciliations')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(reconciliationResponse.body)).toBe(true);
    expect(reconciliationResponse.body.length).toBeGreaterThan(0);
    expect(reconciliationResponse.body[0]).toHaveProperty('alerts');

    const balancesResponse = await request(app.getHttpServer())
      .get('/api/v1/commissions/balances')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(balancesResponse.body)).toBe(true);
    const balance = balancesResponse.body.find(
      (entry: { influencerId: string }) => entry.influencerId === createdInfluencerId
    );
    expect(balance).toBeDefined();
    expect(balance.confirmedAmount).toBe(25000);
    expect(balance.availableForWithdrawal).toBe(25000);

    const evaluationDate = new Date().toISOString();
    const tierEvaluation = await request(app.getHttpServer())
      .post('/api/v1/commissions/tiers/evaluate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ evaluationDate, triggeredBy: 'integration-test' })
      .expect(201);

    expect(Array.isArray(tierEvaluation.body)).toBe(true);
    const tierResult = tierEvaluation.body.find(
      (entry: { influencerId: string; campaignId: string }) =>
        entry.influencerId === createdInfluencerId && entry.campaignId === campaignId
    );
    expect(tierResult).toBeDefined();
    expect(tierResult.salesVolume).toBe(250000);
    expect(tierResult.changed).toBe(false);

    const tierHistory = await request(app.getHttpServer())
      .get('/api/v1/commissions/tiers/history')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ influencerId: createdInfluencerId })
      .expect(200);

    expect(Array.isArray(tierHistory.body)).toBe(true);
    expect(tierHistory.body.length).toBeGreaterThan(0);
    expect(tierHistory.body[0]).toHaveProperty('tierLevel');

    const settlementResponse = await request(app.getHttpServer())
      .post('/api/v1/commissions/settlements/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ evaluationDate, waitingPeriodDays: 0, triggeredBy: 'integration-test' })
      .expect(201);

    expect(Array.isArray(settlementResponse.body.confirmed)).toBe(true);
    expect(Array.isArray(settlementResponse.body.reverted)).toBe(true);
    expect(Array.isArray(settlementResponse.body.pending)).toBe(true);

    const auditResponse = await request(app.getHttpServer())
      .get('/api/v1/commissions/audit')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(auditResponse.body)).toBe(true);
    expect(auditResponse.body.length).toBeGreaterThan(0);

    const globalAudit = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(globalAudit.body).toHaveProperty('commissionTrail');
    expect(globalAudit.body).toHaveProperty('tierHistory');
    expect(Array.isArray(globalAudit.body.commissionTrail)).toBe(true);
    expect(globalAudit.body.commissionTrail.length).toBeGreaterThan(0);

    const policiesResponse = await request(app.getHttpServer())
      .get('/api/v1/payments/policies')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(policiesResponse.body)).toBe(true);
    const policy = policiesResponse.body.find(
      (item: { brandId: string }) => item.brandId === brandId
    );
    expect(policy).toBeDefined();
    expect(policy.minimumAmount).toBe(20000);

    const withdrawalAmount = 20000;
    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/payments/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        influencerId: createdInfluencerId,
        brandId,
        amount: withdrawalAmount,
        notes: 'Retiro de prueba'
      })
      .expect(201);

    expect(withdrawalResponse.body.status).toBe('pending');
    const withdrawalId = withdrawalResponse.body.id;
    expect(withdrawalId).toBeDefined();

    const withdrawalsList = await request(app.getHttpServer())
      .get('/api/v1/payments/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(withdrawalsList.body)).toBe(true);
    expect(
      withdrawalsList.body.some((item: { id: string }) => item.id === withdrawalId)
    ).toBe(true);

    const approvalResponse = await request(app.getHttpServer())
      .patch(`/api/v1/payments/withdrawals/${withdrawalId}/decision`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'approved', notes: 'Aprobado en pruebas' })
      .expect(200);

    expect(approvalResponse.body.status).toBe('approved');

    const paymentDate = new Date().toISOString();
    const paymentResponse = await request(app.getHttpServer())
      .post(`/api/v1/payments/withdrawals/${withdrawalId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: withdrawalAmount,
        method: 'transfer',
        paymentDate,
        reference: 'TRX-123',
        taxWithheld: 0
      })
      .expect(201);

    expect(paymentResponse.body.amount).toBe(withdrawalAmount);
    const paymentId = paymentResponse.body.id;
    expect(paymentId).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/payments/${paymentId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'transfer_receipt',
        filename: 'comprobante.pdf',
        url: 'https://storage.local/comprobante.pdf'
      })
      .expect(201);

    const paymentsList = await request(app.getHttpServer())
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(paymentsList.body)).toBe(true);
    const recordedPayment = paymentsList.body.find((item: { id: string }) => item.id === paymentId);
    expect(recordedPayment).toBeDefined();
    expect(Array.isArray(recordedPayment.appliedAdjustmentIds)).toBe(true);

    const withdrawalsAfterPayment = await request(app.getHttpServer())
      .get('/api/v1/payments/withdrawals')
      .query({ influencerId: createdInfluencerId })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const paidWithdrawal = withdrawalsAfterPayment.body.find(
      (item: { id: string }) => item.id === withdrawalId
    );
    expect(paidWithdrawal).toBeDefined();
    expect(paidWithdrawal.status).toBe('paid');

    const balancesAfterPayment = await request(app.getHttpServer())
      .get('/api/v1/commissions/balances')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(balancesAfterPayment.body)).toBe(true);
    const updatedBalance = balancesAfterPayment.body.find(
      (entry: { influencerId: string }) => entry.influencerId === createdInfluencerId
    );
    expect(updatedBalance).toBeDefined();
    expect(updatedBalance.withdrawnAmount).toBe(withdrawalAmount);
    expect(updatedBalance.pendingWithdrawalAmount).toBe(0);
    expect(updatedBalance.availableForWithdrawal).toBe(balance.confirmedAmount - withdrawalAmount);

    const notificationsResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications/pending')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(notificationsResponse.body)).toBe(true);
    const notificationTypes = notificationsResponse.body.map(
      (event: { type: string }) => event.type
    );
    expect(notificationTypes).toEqual(
      expect.arrayContaining(['withdrawal.requested', 'withdrawal.approved', 'payment.recorded'])
    );

    await request(app.getHttpServer())
      .post('/api/v1/vtex/webhooks/orders')
      .send({
        orderId,
        eventType: 'order-canceled',
        status: 'canceled',
        totalAmount: 250000,
        currency: 'COP',
        couponCode: discountCodeValue,
        items: [
          {
            skuId: 'SKU1',
            quantity: 1,
            price: 250000,
            categoryName: 'skincare'
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/vtex/reconciliations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        runDate: new Date().toISOString(),
        type: 'adhoc',
        discrepanciesFound: 1,
        summary: {
          details: {
            statusMismatch: [
              {
                orderId,
                platform: 'paid',
                vtex: 'canceled'
              }
            ]
          }
        }
      })
      .expect(201);

    const balancesAfterReconciliation = await request(app.getHttpServer())
      .get('/api/v1/commissions/balances')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const reconciledBalance = balancesAfterReconciliation.body.find(
      (entry: { influencerId: string }) => entry.influencerId === createdInfluencerId
    );
    expect(reconciledBalance).toBeDefined();
    expect(reconciledBalance.availableForWithdrawal).toBeLessThan(0);
    expect(reconciledBalance.availableForWithdrawal).toBe(-withdrawalAmount);
    expect(reconciledBalance.adjustmentAmount).toBe(withdrawalAmount);

    const adjustmentsResponse = await request(app.getHttpServer())
      .get('/api/v1/payments/adjustments')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(adjustmentsResponse.body)).toBe(true);
    const createdAdjustment = adjustmentsResponse.body.find(
      (item: { orderId?: string }) => item.orderId === orderId
    );
    expect(createdAdjustment).toBeDefined();
    expect(createdAdjustment.status).toBe('pending');
    expect(createdAdjustment.amount).toBe(withdrawalAmount);

    const adjustmentId = createdAdjustment.id as string;

    const resolveResponse = await request(app.getHttpServer())
      .patch(`/api/v1/payments/adjustments/${adjustmentId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ resolutionType: 'written_off', notes: 'Ajuste conciliado en pruebas' })
      .expect(200);

    expect(resolveResponse.body.status).toBe('resolved');
    expect(resolveResponse.body.resolutionType).toBe('written_off');

    const balancesAfterResolution = await request(app.getHttpServer())
      .get('/api/v1/commissions/balances')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const resolvedBalance = balancesAfterResolution.body.find(
      (entry: { influencerId: string }) => entry.influencerId === createdInfluencerId
    );
    expect(resolvedBalance).toBeDefined();
    expect(resolvedBalance.adjustmentAmount).toBe(0);
    expect(resolvedBalance.availableForWithdrawal).toBe(-withdrawalAmount);

    const notificationsAfterAdjustments = await request(app.getHttpServer())
      .get('/api/v1/notifications/pending')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const notificationTypesAfterResolution = notificationsAfterAdjustments.body.map(
      (event: { type: string }) => event.type
    );
    expect(notificationTypesAfterResolution).toEqual(
      expect.arrayContaining([
        'withdrawal.requested',
        'withdrawal.approved',
        'payment.recorded',
        'adjustment.written_off'
      ])
    );
  });

  it('emits reconciliation alerts and exposes metrics', async () => {
    const reconciliationResponse = await request(app.getHttpServer())
      .post('/api/v1/vtex/reconciliations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        runDate: new Date().toISOString(),
        type: 'daily',
        discrepanciesFound: 2,
        summary: { source: 'test' },
        alerts: ['Pedido faltante', 'Monto divergente']
      });

    expect([200, 201]).toContain(reconciliationResponse.status);

    const notificationsResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications/pending')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const alerts = (notificationsResponse.body as Array<{ type: string }>).filter((event) => event.type === 'reconciliation.alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);

    const metricsResponse = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .expect(200);

    expect(metricsResponse.text).toContain('marketing_afiliados_reconciliation_discrepancies_total');
    expect(metricsResponse.text).toContain('marketing_afiliados_alerts_total');
    expect(metricsResponse.text).toContain('marketing_afiliados_api_request_duration_seconds_bucket');

    const emailsResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications/emails')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(emailsResponse.body)).toBe(true);
    const reconciliationEmail = emailsResponse.body.find((email: { category?: string }) => email.category === 'reconciliation.alert');
    expect(reconciliationEmail).toBeDefined();
    expect(reconciliationEmail.delivered).toBe(true);
  });

});
