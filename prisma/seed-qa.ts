import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'medipiel-qa' },
    update: {},
    create: {
      id: 'medipiel-qa',
      name: 'Medipiel QA',
      slug: 'medipiel-qa'
    }
  });

  const roleNames = [
    'admin_dentsu',
    'admin_marca',
    'gestor_afiliados',
    'finance',
    'auditor',
    'influencer'
  ];

  const roles = await Promise.all(
    roleNames.map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    )
  );
  const roleMap = Object.fromEntries(roles.map((role) => [role.name, role.id]));

  const passwordHash = await hash('Changeit!2024', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin.qa@medipiel.co' },
    update: {},
    create: {
      id: 'admin-qa-user',
      tenantId: tenant.id,
      email: 'admin.qa@medipiel.co',
      passwordHash,
      firstName: 'Admin',
      lastName: 'QA'
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_tenantId: {
        userId: adminUser.id,
        roleId: roleMap['admin_dentsu'],
        tenantId: tenant.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: roleMap['admin_dentsu'],
      tenantId: tenant.id
    }
  });

  const brand = await prisma.brand.upsert({
    where: { slug_tenantId: { slug: 'cetaphil-qa', tenantId: tenant.id } },
    update: {},
    create: {
      id: 'brand-cetaphil-qa',
      tenantId: tenant.id,
      name: 'Cetaphil QA',
      slug: 'cetaphil-qa',
      status: 'ACTIVE'
    }
  });

  const policyVersion = await prisma.policyVersion.upsert({
    where: {
      tenantId_policyType_version: {
        tenantId: tenant.id,
        policyType: 'TERMS',
        version: '1.0.0'
      }
    },
    update: {},
    create: {
      id: 'terms-v1-qa',
      tenantId: tenant.id,
      policyType: 'TERMS',
      version: '1.0.0',
      documentUrl: 'https://example.com/policies/terms-v1-qa.pdf',
      checksum: 'checksum-terms-v1-qa',
      publishedAt: now,
      isActive: true
    }
  });

  const influencer = await prisma.influencer.upsert({
    where: { email: 'influencer.qa@medipiel.co' },
    update: {},
    create: {
      id: 'influencer-qa',
      tenantId: tenant.id,
      firstName: 'Isabela',
      lastName: 'QA',
      documentType: 'CC',
      documentNumber: 'CC-QA-001',
      email: 'influencer.qa@medipiel.co',
      phone: '3000000000',
      status: 'APPROVED',
      consents: {
        create: {
          policyVersionId: policyVersion.id,
          consentHash: 'hash-terms-v1-qa',
          acceptedAt: now,
          ipAddress: '127.0.0.1',
          userAgent: 'seed-qa-script'
        }
      }
    }
  });

  await prisma.user.upsert({
    where: { email: influencer.email },
    update: {},
    create: {
      id: influencer.id,
      tenantId: tenant.id,
      email: influencer.email,
      passwordHash,
      firstName: influencer.firstName,
      lastName: influencer.lastName,
      roles: {
        create: {
          roleId: roleMap['influencer'],
          tenantId: tenant.id
        }
      }
    }
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: 'campaign-qa-boost' },
    update: {},
    create: {
      id: 'campaign-qa-boost',
      tenantId: tenant.id,
      brandId: brand.id,
      name: 'Campaña QA Boost',
      slug: 'campaign-qa-boost',
      status: 'ACTIVE',
      startDate: now,
      commissionBase: 15,
      commissionBasis: 'PRE_TAX',
      eligibleScopeType: 'CATEGORY',
      eligibleScopeValues: ['skincare'],
      maxDiscountPercent: 20,
      maxUsage: 200,
      tierEvaluationPeriodDays: 15
    }
  });

  await prisma.campaignInfluencer.upsert({
    where: {
      influencerId_campaignId: {
        influencerId: influencer.id,
        campaignId: campaign.id
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      influencerId: influencer.id,
      campaignId: campaign.id,
      status: 'ACTIVE'
    }
  });

  const discount = await prisma.discountCode.upsert({
    where: { code: 'QA-BOOST-01' },
    update: {},
    create: {
      id: 'discount-qa-boost-01',
      tenantId: tenant.id,
      campaignId: campaign.id,
      influencerId: influencer.id,
      code: 'QA-BOOST-01',
      status: 'ACTIVE',
      discountPercent: 15,
      startDate: now
    }
  });

  const order = await prisma.order.upsert({
    where: { orderId: 'QA-ORDER-1001' },
    update: {},
    create: {
      orderId: 'QA-ORDER-1001',
      tenantId: tenant.id,
      status: 'PAID',
      totalAmount: 250000,
      currency: 'COP',
      discountCodeId: discount.id,
      influencerId: influencer.id,
      campaignId: campaign.id,
      eligibleAmount: 250000,
      items: {
        create: [
          {
            skuId: 'SKU-QA-001',
            skuRef: 'QA-001',
            title: 'Kit cuidado facial QA',
            quantity: 1,
            unitPrice: 250000,
            totalPrice: 250000,
            taxAmount: 40000,
            category: 'skincare',
            eligibleForCommission: true
          }
        ]
      }
    }
  });

  await prisma.commissionTransaction.upsert({
    where: { orderId: order.orderId },
    update: {},
    create: {
      id: 'commission-qa-1001',
      tenantId: tenant.id,
      orderId: order.orderId,
      orderAttributionId: null,
      influencerId: influencer.id,
      campaignId: campaign.id,
      tierLevel: 1,
      tierName: 'Base',
      state: 'CONFIRMED',
      grossAmount: order.totalAmount,
      eligibleAmount: order.eligibleAmount ?? order.totalAmount,
      commissionRate: 0.15,
      commissionAmount: Math.round((order.eligibleAmount ?? 0) * 0.15),
      calculatedAt: now,
      confirmedAt: now
    }
  });

  await prisma.influencerBalance.upsert({
    where: { influencerId: influencer.id },
    update: {
      confirmedAmount: Math.round((order.eligibleAmount ?? 0) * 0.15),
      estimatedAmount: 0,
      availableForWithdrawal: Math.round((order.eligibleAmount ?? 0) * 0.15),
      lastCalculatedAt: now
    },
    create: {
      influencerId: influencer.id,
      estimatedAmount: 0,
      confirmedAmount: Math.round((order.eligibleAmount ?? 0) * 0.15),
      revertedAmount: 0,
      availableForWithdrawal: Math.round((order.eligibleAmount ?? 0) * 0.15),
      lastCalculatedAt: now
    }
  });

  await prisma.withdrawalRequest.upsert({
    where: { id: 'withdrawal-qa-1' },
    update: {},
    create: {
      id: 'withdrawal-qa-1',
      tenantId: tenant.id,
      influencerId: influencer.id,
      brandId: brand.id,
      requestedAmount: 25000,
      currency: 'COP',
      status: 'APPROVED',
      requestedAt: now,
      processedAt: now,
      processedBy: adminUser.email
    }
  });

  await prisma.payment.upsert({
    where: { id: 'payment-qa-1' },
    update: {},
    create: {
      id: 'payment-qa-1',
      tenantId: tenant.id,
      withdrawalRequestId: 'withdrawal-qa-1',
      influencerId: influencer.id,
      amount: 25000,
      currency: 'COP',
      paymentDate: now,
      method: 'transferencia',
      reference: 'QA-PAY-001',
      processedBy: adminUser.email
    }
  });

  await prisma.reconciliationLog.upsert({
    where: { id: 'reconciliation-qa-1' },
    update: {},
    create: {
      id: 'reconciliation-qa-1',
      tenantId: tenant.id,
      runDate: now,
      type: 'DAILY',
      status: 'SUCCESS',
      discrepanciesFound: 0
    }
  });

  // eslint-disable-next-line no-console
  console.log('Seed QA completado satisfactoriamente.');
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed QA:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
