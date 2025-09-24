import { createHash } from 'crypto';

import { Injectable, Optional, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { v4 as uuid } from 'uuid';

import type {
  CampaignEntity,
  CampaignStatus,
  CampaignTierConfig
} from '../common/interfaces/campaign.interface';
import type { DiscountCodeEntity, DiscountCodeStatus } from '../common/interfaces/discount-code.interface';
import type {
  InfluencerDocument,
  InfluencerEntity,
  InfluencerStatus,
  LegalConsentRecord
} from '../common/interfaces/influencer.interface';
import type {
  CommissionAuditEntry,
  CommissionRecord,
  CommissionSettlementSummary,
  CommissionState,
  InfluencerBalanceRecord,
  OrderEntity,
  OrderItemEntity,
  OrderStatus,
  ReconciliationRecord,
  SettlementTransitionRecord,
  TierAssignmentHistoryRecord,
  TierEvaluationResult,
  WebhookDeliveryLog
} from '../common/interfaces/order.interface';
import type {
  BrandWithdrawalPolicy,
  PaymentRecord,
  WithdrawalDecisionEntry,
  WithdrawalDocument,
  WithdrawalRequestRecord,
  WithdrawalStatus,
  WithdrawalAdjustmentRecord,
  WithdrawalAdjustmentResolutionType,
  WithdrawalAdjustmentStatus,
  WithdrawalAdjustmentType
} from '../common/interfaces/payment.interface';
import type { PolicyType, PolicyVersionRecord } from '../common/interfaces/policy.interface';
import { AppRole } from '../common/interfaces/roles.enum';
import type { AuthUser } from '../common/interfaces/user.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { EncryptionService } from '../common/security/encryption.service';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface BankAccountInput {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  accountType?: string;
}

interface CreateInfluencerInput {
  tenantId: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  socialLinks?: string[];
  bankAccount?: BankAccountInput;
  taxProfile?: string;
  consent: LegalConsentRecord;
  documents?: Array<{
    filename: string;
    contentType: string;
    base64Content?: string;
    checksum?: string;
    size?: number;
    uploadedBy?: string;
  }>;
}

interface UpdateInfluencerStatusInput {
  influencerId: string;
  status: InfluencerStatus;
  rejectionReason?: string;
}

interface UpdateInfluencerDetailsInput {
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  bankAccount?: BankAccountInput;
  taxProfile?: string;
}

interface PublishPolicyVersionInput {
  policyType: PolicyType;
  version: string;
  documentUrl: string;
  checksum: string;
  title?: string;
  publishedAt?: Date;
  tenantId?: string;
  notes?: string;
}

interface CreateCampaignInput {
  tenantId: string;
  brandId: string;
  brandName: string;
  name: string;
  slug: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  status: CampaignStatus;
  commissionBase: number;
  commissionBasis: 'pre_tax' | 'post_tax';
  eligibleScopeType: 'sku' | 'category';
  eligibleScopeValues?: string[];
  maxDiscountPercent?: number;
  maxUsage?: number;
  tierEvaluationPeriodDays?: number;
  tiers?: CampaignTierConfig[];
}

interface UpdateCampaignInput {
  campaignId: string;
  description?: string;
  status?: CampaignStatus;
  endDate?: Date;
  tiers?: CampaignTierConfig[];
  maxDiscountPercent?: number;
  maxUsage?: number;
  tierEvaluationPeriodDays?: number;
}

interface CreateDiscountCodeInput {
  tenantId: string;
  campaignId: string;
  influencerId: string;
  prefix?: string;
  discountPercent?: number;
  expiresAt?: Date;
  maxUsage?: number;
}

interface WithdrawalDocumentInput {
  type: WithdrawalDocument['type'];
  filename: string;
  url: string;
  notes?: string;
}

interface RequestWithdrawalInput {
  influencerId: string;
  amount: number;
  brandId: string;
  initiatedBy: string;
  notes?: string;
  documents?: WithdrawalDocumentInput[];
  tenantId?: string;
  reconciliationIds?: string[];
}

interface DecideWithdrawalInput {
  withdrawalId: string;
  status: Extract<WithdrawalStatus, 'approved' | 'rejected'>;
  processedBy: string;
  notes?: string;
  paymentReference?: string;
}

interface RecordPaymentInput {
  withdrawalId: string;
  amount: number;
  method: string;
  paymentDate: Date;
  processedBy: string;
  reference?: string;
  voucherUrl?: string;
  taxWithheld?: number;
  reconciliationId?: string;
  documents?: WithdrawalDocumentInput[];
  adjustmentIds?: string[];
}

interface RegisterOrderEventInput {
  orderId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  couponCode?: string;
  items: OrderItemEntity[];
  eventType: 'order-created' | 'order-paid' | 'order-canceled';
  shippingAmount?: number;
  taxAmount?: number;
  eligibleAmount?: number;
  includeShippingInEligible?: boolean;
  rawPayload?: unknown;
}

interface ReconciliationInputInternal {
  runDate: Date;
  type: 'daily' | 'fortnightly' | 'adhoc';
  discrepanciesFound: number;
  reportUrl?: string;
  summary?: Record<string, unknown>;
  alerts?: string[];
  triggeredBy?: string;
}

interface CampaignTierSnapshot {
  name: string;
  level: number;
  commissionPercent: number;
  thresholdConfirmedSales: number;
}

interface InfluencerTierAssignment {
  key: string;
  tenantId: string;
  campaignId: string;
  influencerId: string;
  evaluationPeriodDays: number;
  currentTier: CampaignTierSnapshot;
  currentWindowStart: Date;
  lastEvaluationAt: Date;
  history: TierAssignmentHistoryRecord[];
}

@Injectable()
export class InMemoryDatabaseService implements OnModuleInit {
  private readonly users = new Map<string, AuthUser>();
  private readonly influencers = new Map<string, InfluencerEntity>();
  private readonly campaigns = new Map<string, CampaignEntity>();
  private readonly discountCodes = new Map<string, DiscountCodeEntity>();
  private readonly discountCodesByCode = new Map<string, DiscountCodeEntity>();
  private readonly orders = new Map<string, OrderEntity>();
  private readonly commissions = new Map<string, CommissionRecord>();
  private readonly reconciliationLogs: ReconciliationRecord[] = [];
  private readonly webhookLogs: WebhookDeliveryLog[] = [];
  private readonly balances = new Map<string, InfluencerBalanceRecord>();
  private readonly tierAssignments = new Map<string, InfluencerTierAssignment>();
  private readonly commissionAuditEntries: CommissionAuditEntry[] = [];
  private readonly tierHistory: TierAssignmentHistoryRecord[] = [];
  private readonly withdrawalRequests = new Map<string, WithdrawalRequestRecord>();
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly withdrawalAdjustments = new Map<string, WithdrawalAdjustmentRecord>();
  private readonly withdrawalAdjustmentsByOrder = new Map<string, string>();
  private readonly brandWithdrawalPolicies = new Map<string, BrandWithdrawalPolicy>();
  private readonly policyVersions = new Map<PolicyType, PolicyVersionRecord[]>();
  private readonly bankAccountVault = new Map<string, { encrypted: string; last4: string }>();
  private readonly documentVault = new Map<string, string>();
  private encryption?: EncryptionService;

  constructor(@Optional() encryption?: EncryptionService, private readonly moduleRef: ModuleRef) {
    // Defer seeding to onModuleInit so DI graph is fully resolved and
    // services like EncryptionService are available. Avoid heavy work in ctor.
    this.encryption = encryption;
  }

  onModuleInit() {
    if (!this.encryption) {
      const resolved = this.moduleRef.get(EncryptionService, { strict: false });
      if (resolved) {
        this.encryption = resolved;
      } else {
        // eslint-disable-next-line no-console
        console.warn('EncryptionService not resolved; falling back to base64 encoding for seeded data.');
      }
    }

    try {
      this.seedUsers();
      this.seedPolicyVersions();
      this.seedBrandPolicies();
      this.seedCampaigns();
      this.seedDemoData();
    } catch (err) {
      // Fail-safe: log to console so early startup doesn't crash in weird DI scenarios
      // Nest's logger isn't available here without injecting it; use console.warn.
      // The app can continue running with minimal demo data missing.
      // eslint-disable-next-line no-console
      console.warn('Error during DB seeding:', err instanceof Error ? err.message : String(err));
    }
  }

  private maskAccountNumber(accountNumber: string): string {
    const digitsOnly = accountNumber.replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      return '****';
    }
    const last4 = digitsOnly.slice(-4);
    const maskedPrefixLength = Math.max(digitsOnly.length - 4, 0);
    const maskedPrefix = maskedPrefixLength > 0 ? '*'.repeat(maskedPrefixLength) : '****';
    return `${maskedPrefix}${last4}`;
  }

  private getEncryptor(): Pick<EncryptionService, 'encrypt'> {
    if (this.encryption && typeof this.encryption.encrypt === 'function') {
      return this.encryption;
    }

    return {
      encrypt: (plain: string) => Buffer.from(plain, 'utf8').toString('base64')
    } as const;
  }

  private persistBankAccount(influencerId: string, bankAccount?: BankAccountInput) {
    if (!bankAccount) {
      this.bankAccountVault.delete(influencerId);
      return undefined;
    }
    const payload = JSON.stringify(bankAccount);
    const encrypted = this.getEncryptor().encrypt(payload);
    const last4 = bankAccount.accountNumber.replace(/[^0-9]/g, '').slice(-4);
    this.bankAccountVault.set(influencerId, { encrypted, last4 });

    return {
      accountHolder: bankAccount.accountHolder,
      bankName: bankAccount.bankName,
      accountType: bankAccount.accountType,
      accountNumber: this.maskAccountNumber(bankAccount.accountNumber),
      last4
    };
  }

  private storeDocumentContent(documentId: string, base64Content?: string) {
    if (!base64Content) {
      this.documentVault.delete(documentId);
      return;
    }

    this.documentVault.set(documentId, this.getEncryptor().encrypt(base64Content));
  }

  /* Users */
  private seedUsers() {
    const sharedPasswordHash = '$2a$10$MpDmSjlL4EBzlG/e8uDDgOob7coQXFlM9htxVZvHVmjTS8EEsmnXa';
    const sharedTwoFactorSecret = 'JBSWY3DPEHPK3PXP';
    const influencerUserId = uuid();

    const defaultUsers: AuthUser[] = [
      {
        id: uuid(),
        email: 'admin@medipiel.co',
        passwordHash: sharedPasswordHash,
        firstName: 'Super',
        lastName: 'Admin',
        roles: [AppRole.ADMIN_DENTSU],
        tenantId: 'medipiel',
        twoFactorEnabled: true,
        twoFactorSecret: sharedTwoFactorSecret
      },
      {
        id: uuid(),
        email: 'gestor@medipiel.co',
        passwordHash: sharedPasswordHash,
        firstName: 'Gestor',
        lastName: 'Afiliados',
        roles: [AppRole.GESTOR_AFILIADOS],
        tenantId: 'medipiel',
        twoFactorEnabled: true,
        twoFactorSecret: sharedTwoFactorSecret
      },
      {
        id: uuid(),
        email: 'finance@medipiel.co',
        passwordHash: sharedPasswordHash,
        firstName: 'Finance',
        lastName: 'Team',
        roles: [AppRole.FINANCE],
        tenantId: 'medipiel',
        twoFactorEnabled: true,
        twoFactorSecret: sharedTwoFactorSecret
      },
      {
        id: uuid(),
        email: 'marca@medipiel.co',
        passwordHash: sharedPasswordHash,
        firstName: 'Admin',
        lastName: 'Marca',
        roles: [AppRole.ADMIN_MARCA],
        tenantId: 'medipiel',
        twoFactorEnabled: true,
        twoFactorSecret: sharedTwoFactorSecret
      },
      {
        id: uuid(),
        email: 'auditor@medipiel.co',
        passwordHash: sharedPasswordHash,
        firstName: 'Equipo',
        lastName: 'Auditoría',
        roles: [AppRole.AUDITOR],
        tenantId: 'medipiel',
        twoFactorEnabled: true,
        twoFactorSecret: sharedTwoFactorSecret
      },
      {
        id: influencerUserId,
        email: 'influencer@medipiel.co',
        passwordHash: sharedPasswordHash,
        firstName: 'Isabela',
        lastName: 'Influencer',
        roles: [AppRole.INFLUENCER],
        tenantId: 'medipiel'
      }
    ];

    defaultUsers.forEach((user) => this.users.set(user.email.toLowerCase(), user));

    const influencerUser = defaultUsers.find((user) => user.id === influencerUserId);
    if (influencerUser) {
      this.seedDemoInfluencerAccount(influencerUser);
    }
  }

  private seedBrandPolicies() {
    const defaults: BrandWithdrawalPolicy[] = [
      {
        brandId: 'cetaphil',
        brandName: 'Cetaphil',
        minimumAmount: 20000,
        currency: 'COP',
        waitingPeriodDays: 7
      }
    ];

    defaults.forEach((policy) => this.brandWithdrawalPolicies.set(policy.brandId, policy));
  }

  private seedCampaigns() {
    const sampleCampaign: CampaignEntity = {
      id: uuid(),
      tenantId: 'medipiel',
      brandId: 'cetaphil',
      brandName: 'Cetaphil',
      name: 'Cetaphil Lanzamiento',
      slug: 'cetaphil-lanzamiento',
      description: 'Campaña de lanzamiento Cetaphil',
      startDate: new Date(),
      endDate: undefined,
      status: 'active',
      commissionBase: 10,
      commissionBasis: 'pre_tax',
      eligibleScopeType: 'category',
      eligibleScopeValues: ['skincare'],
      maxDiscountPercent: 15,
      maxUsage: 1000,
      tierEvaluationPeriodDays: 15,
      tiers: [
        {
          name: 'Base',
          level: 1,
          commissionPercent: 10,
          thresholdConfirmedSales: 0
        },
        {
          name: 'Avanzado',
          level: 2,
          commissionPercent: 12,
          thresholdConfirmedSales: 500000
        }
      ],
      assignedInfluencerIds: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.campaigns.set(sampleCampaign.id, sampleCampaign);
  }

  private seedDemoInfluencerAccount(user: AuthUser) {
    const now = new Date();
    const influencer: InfluencerEntity = {
      id: user.id,
      tenantId: user.tenantId,
      firstName: user.firstName,
      lastName: user.lastName,
      documentType: 'CC',
      documentNumber: 'CC-DEMO-001',
      email: user.email,
      phone: '3001234567',
      address: 'Calle 123 #45-67',
      city: 'Bogotá',
      country: 'Colombia',
      socialLinks: ['https://www.instagram.com/medipiel_demo'],
      bankAccount: undefined,
      taxProfile: 'Régimen simplificado',
      status: 'approved',
      rejectionReason: undefined,
      createdAt: now,
      updatedAt: now,
      consents: [
        {
          policyVersionId: 'terms-v1',
          acceptedAt: now,
          consentHash: 'demo-consent-hash',
          ipAddress: '127.0.0.1',
          userAgent: 'seed-script'
        }
      ],
      documents: [],
      assignedCampaignIds: [],
      roles: [AppRole.INFLUENCER]
    };

    influencer.bankAccount = this.persistBankAccount(influencer.id, {
      accountHolder: `${user.firstName} ${user.lastName}`,
      bankName: 'Bancolombia',
      accountNumber: '00123456789',
      accountType: 'ahorros'
    });

    this.influencers.set(influencer.id, influencer);
    this.ensureInfluencerBalance(influencer.id, influencer.tenantId);
  }

  private seedPolicyVersions() {
    const publishedAt = new Date('2024-01-15T12:00:00Z');
    const basePolicies: PolicyVersionRecord[] = [
      {
        id: 'terms-v1',
        tenantId: 'medipiel',
        policyType: 'terms',
        version: '1.0.0',
        documentUrl: 'https://policies.medipiel.com/terms/v1',
        checksum: 'sha256:terms-v1-demo',
        publishedAt,
        isActive: true,
        title: 'Términos y condiciones – Programa de Afiliados',
        createdAt: publishedAt
      },
      {
        id: 'privacy-v1',
        tenantId: 'medipiel',
        policyType: 'privacy',
        version: '1.0.0',
        documentUrl: 'https://policies.medipiel.com/privacy/v1',
        checksum: 'sha256:privacy-v1-demo',
        publishedAt,
        isActive: true,
        title: 'Política de Tratamiento de Datos Personales',
        createdAt: publishedAt
      },
      {
        id: 'habeas-v1',
        tenantId: 'medipiel',
        policyType: 'habeas_data',
        version: '1.0.0',
        documentUrl: 'https://policies.medipiel.com/habeas-data/v1',
        checksum: 'sha256:habeas-data-v1-demo',
        publishedAt,
        isActive: true,
        title: 'Autorización Habeas Data',
        createdAt: publishedAt
      }
    ];

    basePolicies.forEach((policy) => {
      const list = this.policyVersions.get(policy.policyType) ?? [];
      list.push({ ...policy });
      this.policyVersions.set(policy.policyType, list);
    });
  }

  /* Policy versions */
  getActivePolicyVersions(): PolicyVersionRecord[] {
    return Array.from(this.policyVersions.values())
      .flat()
      .filter((policy) => policy.isActive)
      .map((policy) => ({
        ...policy,
        publishedAt: new Date(policy.publishedAt),
        createdAt: new Date(policy.createdAt)
      }));
  }

  getPolicyVersionById(policyVersionId: string): PolicyVersionRecord | undefined {
    for (const policies of this.policyVersions.values()) {
      const match = policies.find((policy) => policy.id === policyVersionId);
      if (match) {
        return {
          ...match,
          publishedAt: new Date(match.publishedAt),
          createdAt: new Date(match.createdAt)
        };
      }
    }
    return undefined;
  }

  listInfluencerConsents(influencerId: string) {
    const influencer = this.influencers.get(influencerId);
    if (!influencer) {
      return [];
    }

    return influencer.consents.map((consent) => {
      const policy = this.getPolicyVersionById(consent.policyVersionId);
      return {
        policyVersionId: consent.policyVersionId,
        policyType: policy?.policyType,
        version: policy?.version,
        title: policy?.title,
        documentUrl: policy?.documentUrl,
        checksum: policy?.checksum,
        acceptedAt: consent.acceptedAt.toISOString(),
        consentHash: consent.consentHash,
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent
      };
    });
  }

  generateConsentCertificate(influencerId: string, policyVersionId: string) {
    const influencer = this.influencers.get(influencerId);
    if (!influencer) {
      throw new Error(`Influencer ${influencerId} no encontrado`);
    }

    const consent = influencer.consents.find((item) => item.policyVersionId === policyVersionId);
    if (!consent) {
      throw new Error(`Consentimiento para política ${policyVersionId} no encontrado`);
    }

    const policy = this.getPolicyVersionById(policyVersionId);
    if (!policy) {
      throw new Error(`Política ${policyVersionId} no encontrada`);
    }

    const issuedAt = new Date();
    const certificateId = uuid();
    const signatureSource = `${influencer.id}:${policy.id}:${consent.consentHash}:${issuedAt.toISOString()}`;
    const checksum = createHash('sha256').update(signatureSource).digest('hex');

    return {
      certificateId,
      issuedAt: issuedAt.toISOString(),
      influencer: {
        id: influencer.id,
        firstName: influencer.firstName,
        lastName: influencer.lastName,
        email: influencer.email
      },
      policy: {
        id: policy.id,
        type: policy.policyType,
        version: policy.version,
        title: policy.title,
        documentUrl: policy.documentUrl,
        checksum: policy.checksum
      },
      consent: {
        acceptedAt: consent.acceptedAt.toISOString(),
        consentHash: consent.consentHash,
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent
      },
      checksum
    };
  }

  publishPolicyVersion(input: PublishPolicyVersionInput): PolicyVersionRecord {
    const publishedAt = input.publishedAt ?? new Date();
    const record: PolicyVersionRecord = {
      id: uuid(),
      tenantId: input.tenantId ?? 'medipiel',
      policyType: input.policyType,
      version: input.version,
      documentUrl: input.documentUrl,
      checksum: input.checksum,
      publishedAt,
      isActive: true,
      title: input.title,
      createdAt: new Date(),
      notes: input.notes
    };

    const existing = this.policyVersions.get(input.policyType) ?? [];
    existing.forEach((policy) => {
      policy.isActive = false;
    });
    existing.push(record);
    this.policyVersions.set(input.policyType, existing);

    return {
      ...record,
      publishedAt: new Date(record.publishedAt),
      createdAt: new Date(record.createdAt)
    };
  }

  getActivePolicyVersionByType(policyType: PolicyType): PolicyVersionRecord | undefined {
    const policies = this.policyVersions.get(policyType) ?? [];
    const active = policies.find((policy) => policy.isActive);
    return active
      ? {
          ...active,
          publishedAt: new Date(active.publishedAt),
          createdAt: new Date(active.createdAt)
        }
      : undefined;
  }

  private seedDemoData() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const influencer = Array.from(this.influencers.values())[0];
    const campaign = Array.from(this.campaigns.values())[0];

    if (!influencer || !campaign) {
      return;
    }

    this.assignInfluencerToCampaign(influencer.id, campaign.id);

    const discount = this.createDiscountCode({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      influencerId: influencer.id,
      prefix: 'DEMO',
      discountPercent: 10,
      maxUsage: 500
    });

    const demoItems = [
      {
        skuId: 'SKU-DEMO-1',
        quantity: 1,
        price: 220000,
        categoryName: 'skincare'
      }
    ];

    this.registerOrderEvent({
      orderId: 'DEMO-ORDER-1',
      status: 'created',
      totalAmount: 220000,
      currency: 'COP',
      couponCode: discount.code,
      items: demoItems,
      eventType: 'order-created'
    });

    this.registerOrderEvent({
      orderId: 'DEMO-ORDER-1',
      status: 'paid',
      totalAmount: 220000,
      currency: 'COP',
      couponCode: discount.code,
      items: demoItems,
      eventType: 'order-paid'
    });

    this.registerOrderEvent({
      orderId: 'DEMO-ORDER-2',
      status: 'created',
      totalAmount: 180000,
      currency: 'COP',
      couponCode: discount.code,
      items: [
        {
          skuId: 'SKU-DEMO-2',
          quantity: 2,
          price: 90000,
          categoryName: 'skincare'
        }
      ],
      eventType: 'order-created'
    });

    const withdrawal = this.requestWithdrawal({
      influencerId: influencer.id,
      brandId: campaign.brandId,
      amount: 20000,
      initiatedBy: influencer.email,
      tenantId: influencer.tenantId,
      notes: 'Retiro de demostración'
    });

    this.decideWithdrawal({
      withdrawalId: withdrawal.id,
      status: 'approved',
      processedBy: 'finance@medipiel.co'
    });

    this.recordPayment({
      withdrawalId: withdrawal.id,
      amount: withdrawal.requestedAmount,
      method: 'transferencia',
      paymentDate: new Date(),
      processedBy: 'finance@medipiel.co',
      reference: 'PAY-DEMO-1'
    });

    this.recordReconciliation({
      runDate: new Date(),
      type: 'daily',
      discrepanciesFound: 0,
      summary: { demo: true },
      alerts: []
    });
  }

  findUserByEmail(email: string): AuthUser | undefined {
    return this.users.get(email.toLowerCase());
  }

  findUserById(id: string): AuthUser | undefined {
    for (const user of this.users.values()) {
      if (user.id === id) {
        return user;
      }
    }
    return undefined;
  }

  updateUserPassword(userId: string, passwordHash: string) {
    for (const [email, user] of this.users.entries()) {
      if (user.id === userId) {
        this.users.set(email, { ...user, passwordHash });
        return;
      }
    }
  }

  /* Influencers */
  listInfluencers(): InfluencerEntity[] {
    return Array.from(this.influencers.values());
  }

  getInfluencerById(id: string): InfluencerEntity | undefined {
    return this.influencers.get(id);
  }

  createInfluencer(input: CreateInfluencerInput): InfluencerEntity {
    if (!input.email) {
      throw new Error('Email requerido para crear influencer');
    }

    const now = new Date();
    const influencerId = uuid();
    const documents: InfluencerDocument[] = (input.documents ?? []).map((document) => {
      const documentId = uuid();
      if (document.base64Content) {
        this.storeDocumentContent(documentId, document.base64Content);
      }
      return {
        id: documentId,
        filename: document.filename,
        contentType: document.contentType,
        checksum: document.checksum,
        uploadedAt: now,
        uploadedBy: document.uploadedBy ?? input.email,
        url: `secure://vault/${documentId}`
      };
    });

    const influencer: InfluencerEntity = {
      id: influencerId,
      tenantId: input.tenantId,
      firstName: input.firstName,
      lastName: input.lastName,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      email: input.email.toLowerCase(),
      phone: input.phone,
      address: input.address,
      city: input.city,
      country: input.country,
      socialLinks: input.socialLinks ?? [],
      bankAccount: this.persistBankAccount(influencerId, input.bankAccount),
      taxProfile: input.taxProfile,
      status: 'pending',
      rejectionReason: undefined,
      createdAt: now,
      updatedAt: now,
      consents: [input.consent],
      documents,
      assignedCampaignIds: [],
      roles: [AppRole.INFLUENCER]
    };

    this.influencers.set(influencer.id, influencer);
    return influencer;
  }

  updateInfluencerStatus({ influencerId, status, rejectionReason }: UpdateInfluencerStatusInput) {
    const influencer = this.influencers.get(influencerId);
    if (!influencer) {
      return undefined;
    }

    influencer.status = status;
    influencer.rejectionReason = status === 'rejected' ? rejectionReason : undefined;
    influencer.updatedAt = new Date();
    this.influencers.set(influencer.id, influencer);
    return influencer;
  }

  assignInfluencerToCampaign(influencerId: string, campaignId: string) {
    const influencer = this.influencers.get(influencerId);
    const campaign = this.campaigns.get(campaignId);

    if (!influencer || !campaign) {
      return undefined;
    }

    if (!influencer.assignedCampaignIds.includes(campaignId)) {
      influencer.assignedCampaignIds.push(campaignId);
    }

    if (!campaign.assignedInfluencerIds.includes(influencerId)) {
      campaign.assignedInfluencerIds.push(influencerId);
      campaign.updatedAt = new Date();
    }

    this.ensureInfluencerBalance(influencer.id, campaign.tenantId);
    this.ensureTierAssignment({ influencerId: influencer.id, campaign });

    return { influencer, campaign };
  }

  registerOrderEvent(input: RegisterOrderEventInput) {
    const discount = input.couponCode
      ? this.findDiscountCodeByCode(input.couponCode)
      : undefined;

    const tenantId = discount?.tenantId ?? 'medipiel';
    const previousOrder = this.orders.get(input.orderId);
    const campaign = discount?.campaignId
      ? this.campaigns.get(discount.campaignId)
      : previousOrder?.campaignId
        ? this.campaigns.get(previousOrder.campaignId)
        : undefined;
    const influencer = discount?.influencerId
      ? this.influencers.get(discount.influencerId)
      : previousOrder?.influencerId
        ? this.influencers.get(previousOrder.influencerId)
        : undefined;

    const now = new Date();
    const eligibleAmount =
      input.eligibleAmount ??
      this.calculateEligibleAmount({
        campaign,
        items: input.items,
        taxAmount: input.taxAmount,
        shippingAmount: input.shippingAmount,
        includeShipping: input.includeShippingInEligible
      });

    const existingOrder = previousOrder;
    const order: OrderEntity = existingOrder
      ? {
          ...existingOrder,
          status: input.status,
          totalAmount: input.totalAmount,
          currency: input.currency,
          items: input.items,
          shippingAmount: input.shippingAmount ?? existingOrder.shippingAmount,
          taxAmount: input.taxAmount ?? existingOrder.taxAmount,
          eligibleAmount,
          updatedAt: now,
          rawPayload: input.rawPayload ?? existingOrder.rawPayload
        }
      : {
          id: input.orderId,
          tenantId,
          status: input.status,
          totalAmount: input.totalAmount,
          currency: input.currency,
          shippingAmount: input.shippingAmount,
          taxAmount: input.taxAmount,
          eligibleAmount,
          discountCodeId: discount?.id,
          influencerId: discount?.influencerId ?? influencer?.id,
          campaignId: discount?.campaignId ?? campaign?.id,
          items: input.items,
          createdAt: now,
          updatedAt: now,
          rawPayload: input.rawPayload
        };

    this.orders.set(order.id, order);

    let commission: CommissionRecord | undefined;
    if (order.influencerId && order.campaignId && influencer && campaign) {
      const previousCommission = this.commissions.get(order.id);
      const nextState = this.resolveCommissionState(input.eventType);
      const tierSnapshot = this.resolveCurrentTierSnapshot({
        campaign,
        influencerId: order.influencerId
      });

      const commissionRate = tierSnapshot.commissionPercent ?? campaign.commissionBase ?? 0;
      const eligibleAmountValue = order.eligibleAmount ?? 0;
      const commissionAmount = this.calculateCommissionAmount(eligibleAmountValue, commissionRate);
      const commissionId = previousCommission?.id ?? uuid();
      const auditEntry: CommissionAuditEntry = {
        id: uuid(),
        commissionId,
        previousState: previousCommission?.state ?? null,
        nextState,
        changedAt: now,
        triggeredBy: 'system',
        context: `event:${input.eventType}`
      };

      const metadata = {
        ...(previousCommission?.metadata ?? {}),
        tierThreshold: tierSnapshot.thresholdConfirmedSales,
        eventType: input.eventType,
        includeShipping: Boolean(input.includeShippingInEligible)
      };

      const confirmedAt = nextState === 'CONFIRMED' ? now : previousCommission?.confirmedAt;
      const revertedAt =
        nextState === 'REVERTED'
          ? now
          : nextState === 'ESTIMATED'
            ? undefined
            : previousCommission?.revertedAt;

      const reason = nextState === 'REVERTED' ? 'order-canceled' : previousCommission?.reason;

      commission = {
        id: commissionId,
        tenantId,
        orderId: order.id,
        influencerId: order.influencerId,
        campaignId: order.campaignId,
        state: nextState,
        grossAmount: order.totalAmount,
        eligibleAmount: eligibleAmountValue,
        commissionRate,
        commissionAmount,
        tierLevel: tierSnapshot.level,
        tierName: tierSnapshot.name,
        calculatedAt: now,
        confirmedAt,
        revertedAt,
        reason,
        metadata,
        auditTrail: [...(previousCommission?.auditTrail ?? []), auditEntry]
      };

      this.persistCommission(previousCommission, commission, auditEntry);
    }

    return { order, commission };
  }

  listOrders(): OrderEntity[] {
    return Array.from(this.orders.values());
  }

  listCommissions(): CommissionRecord[] {
    return Array.from(this.commissions.values());
  }

  recordReconciliation(entry: ReconciliationInputInternal) {
    const record: ReconciliationRecord = {
      id: uuid(),
      tenantId: 'medipiel',
      runDate: entry.runDate,
      type: entry.type,
      discrepanciesFound: entry.discrepanciesFound,
      reportUrl: entry.reportUrl,
      summary: entry.summary,
      alerts: entry.alerts,
      createdAt: new Date()
    };

    this.reconciliationLogs.push(record);
    this.processReconciliationAdjustments(record);
    return record;
  }

  listReconciliations(): ReconciliationRecord[] {
    return [...this.reconciliationLogs];
  }

  listInfluencerBalances(): InfluencerBalanceRecord[] {
    return Array.from(this.balances.values()).map((balance) => ({ ...balance }));
  }

  getInfluencerBalance(influencerId: string, tenantId = 'medipiel'): InfluencerBalanceRecord | undefined {
    const key = this.getBalanceKey(influencerId, tenantId);
    const balance = this.balances.get(key);
    return balance ? { ...balance } : undefined;
  }

  listCommissionAuditTrail(): CommissionAuditEntry[] {
    return [...this.commissionAuditEntries];
  }

  listTierHistory(filters?: { campaignId?: string; influencerId?: string }): TierAssignmentHistoryRecord[] {
    return this.tierHistory.filter((entry) => {
      if (filters?.campaignId && entry.campaignId !== filters.campaignId) {
        return false;
      }
      if (filters?.influencerId && entry.influencerId !== filters.influencerId) {
        return false;
      }
      return true;
    });
  }

  evaluateTiers(input: { evaluationDate?: Date; triggeredBy?: string } = {}) {
    const evaluationDate = input.evaluationDate ?? new Date();
    const triggeredBy = input.triggeredBy ?? 'system';
    const results: TierEvaluationResult[] = [];

    for (const assignment of this.tierAssignments.values()) {
      const campaign = this.campaigns.get(assignment.campaignId);
      if (!campaign) {
        continue;
      }

      const windowStart = assignment.currentWindowStart;
      const windowEnd = evaluationDate;
      if (windowEnd < windowStart) {
        assignment.currentWindowStart = evaluationDate;
        assignment.lastEvaluationAt = evaluationDate;
        continue;
      }

      const salesVolume = this.calculateConfirmedSalesVolume({
        influencerId: assignment.influencerId,
        campaignId: assignment.campaignId,
        windowStart,
        windowEnd
      });

      const previousTier = assignment.currentTier;
      const nextTier = this.resolveTierForSales(campaign, salesVolume);
      const changed = nextTier.level !== previousTier.level;

      if (changed) {
        const lastHistory = assignment.history[assignment.history.length - 1];
        if (lastHistory) {
          lastHistory.effectiveTo = evaluationDate;
          lastHistory.windowEnd = windowEnd;
          lastHistory.salesVolume = salesVolume;
        }

        const newHistory: TierAssignmentHistoryRecord = {
          id: uuid(),
          influencerId: assignment.influencerId,
          campaignId: assignment.campaignId,
          tierLevel: nextTier.level,
          tierName: nextTier.name,
          commissionRate: nextTier.commissionPercent,
          effectiveFrom: evaluationDate,
          effectiveTo: undefined,
          windowStart,
          windowEnd,
          salesVolume,
          reason: 'tier-evaluation',
          triggeredBy
        };

        assignment.history.push(newHistory);
        this.tierHistory.push(newHistory);
        assignment.currentTier = nextTier;
      } else {
        const lastHistory = assignment.history[assignment.history.length - 1];
        if (lastHistory) {
          lastHistory.windowEnd = windowEnd;
          lastHistory.salesVolume = salesVolume;
        }
      }

      assignment.currentWindowStart = evaluationDate;
      assignment.lastEvaluationAt = evaluationDate;

      results.push({
        influencerId: assignment.influencerId,
        campaignId: assignment.campaignId,
        previousTier: {
          name: previousTier.name,
          level: previousTier.level,
          commissionRate: previousTier.commissionPercent
        },
        newTier: {
          name: assignment.currentTier.name,
          level: assignment.currentTier.level,
          commissionRate: assignment.currentTier.commissionPercent
        },
        changed,
        salesVolume,
        windowStart,
        windowEnd,
        triggeredBy
      });
    }

    return results;
  }

  runSettlement(input: {
    evaluationDate?: Date;
    waitingPeriodDays?: number;
    triggeredBy?: string;
  } = {}): CommissionSettlementSummary {
    const evaluationDate = input.evaluationDate ?? new Date();
    const waitingPeriodDays = input.waitingPeriodDays ?? 15;
    const triggeredBy = input.triggeredBy ?? 'system';
    const thresholdDate = new Date(evaluationDate.getTime() - waitingPeriodDays * DAY_IN_MS);

    const confirmed: SettlementTransitionRecord[] = [];
    const reverted: SettlementTransitionRecord[] = [];
    const pending: SettlementTransitionRecord[] = [];

    const snapshot = Array.from(this.commissions.values());

    for (const commission of snapshot) {
      const order = this.orders.get(commission.orderId);
      if (!order) {
        pending.push({
          commissionId: commission.id,
          orderId: commission.orderId,
          previousState: commission.state,
          nextState: commission.state,
          influencerId: commission.influencerId,
          campaignId: commission.campaignId,
          commissionAmount: commission.commissionAmount,
          effectiveAt: evaluationDate,
          reason: 'order-missing'
        });
        continue;
      }

      if (commission.state === 'ESTIMATED') {
        if (this.shouldConfirmCommission({ commission, order, thresholdDate })) {
          const auditEntry: CommissionAuditEntry = {
            id: uuid(),
            commissionId: commission.id,
            previousState: commission.state,
            nextState: 'CONFIRMED',
            changedAt: evaluationDate,
            triggeredBy,
            context: 'settlement:auto'
          };

          const updated: CommissionRecord = {
            ...commission,
            state: 'CONFIRMED',
            confirmedAt: evaluationDate,
            auditTrail: [...commission.auditTrail, auditEntry],
            metadata: {
              ...(commission.metadata ?? {}),
              settlementRunAt: evaluationDate.toISOString(),
              settlementTriggeredBy: triggeredBy
            }
          };

          this.persistCommission(commission, updated, auditEntry);
          confirmed.push({
            commissionId: updated.id,
            orderId: updated.orderId,
            previousState: commission.state,
            nextState: updated.state,
            influencerId: updated.influencerId,
            campaignId: updated.campaignId,
            commissionAmount: updated.commissionAmount,
            effectiveAt: evaluationDate,
            reason: 'waiting-period-met'
          });
        } else {
          const reason =
            order.status === 'created' || order.status === 'paid'
              ? 'waiting-period'
              : `status-${order.status}`;
          pending.push({
            commissionId: commission.id,
            orderId: commission.orderId,
            previousState: commission.state,
            nextState: commission.state,
            influencerId: commission.influencerId,
            campaignId: commission.campaignId,
            commissionAmount: commission.commissionAmount,
            effectiveAt: evaluationDate,
            reason
          });
        }
        continue;
      }

      if (commission.state === 'CONFIRMED') {
        if (order.status === 'canceled' || order.status === 'returned') {
          const auditEntry: CommissionAuditEntry = {
            id: uuid(),
            commissionId: commission.id,
            previousState: commission.state,
            nextState: 'REVERTED',
            changedAt: evaluationDate,
            triggeredBy,
            context: `settlement:${order.status}`
          };

          const updated: CommissionRecord = {
            ...commission,
            state: 'REVERTED',
            revertedAt: evaluationDate,
            reason: `order-${order.status}`,
            auditTrail: [...commission.auditTrail, auditEntry],
            metadata: {
              ...(commission.metadata ?? {}),
              settlementRunAt: evaluationDate.toISOString(),
              settlementTriggeredBy: triggeredBy
            }
          };

          this.persistCommission(commission, updated, auditEntry);
          reverted.push({
            commissionId: updated.id,
            orderId: updated.orderId,
            previousState: commission.state,
            nextState: updated.state,
            influencerId: updated.influencerId,
            campaignId: updated.campaignId,
            commissionAmount: updated.commissionAmount,
            effectiveAt: evaluationDate,
            reason: `order-${order.status}`
          });
        }
      }
    }

    return {
      evaluationDate,
      waitingPeriodDays,
      confirmed,
      reverted,
      pending
    };
  }

  private persistCommission(
    previous: CommissionRecord | undefined,
    updated: CommissionRecord,
    auditEntry: CommissionAuditEntry
  ) {
    this.commissions.set(updated.orderId, updated);
    this.commissionAuditEntries.push(auditEntry);
    this.syncInfluencerBalance(previous, updated);
  }

  private syncInfluencerBalance(previous: CommissionRecord | undefined, current: CommissionRecord) {
    const balance = this.ensureInfluencerBalance(current.influencerId, current.tenantId);

    if (previous) {
      this.applyBalanceDelta(balance, previous.state, -previous.commissionAmount);
    }

    this.applyBalanceDelta(balance, current.state, current.commissionAmount);

    this.recalculateAvailableBalance(balance);

    const key = this.getBalanceKey(current.influencerId, current.tenantId);
    this.balances.set(key, balance);
  }

  private applyBalanceDelta(
    balance: InfluencerBalanceRecord,
    state: CommissionState,
    delta: number
  ) {
    switch (state) {
      case 'ESTIMATED':
        balance.estimatedAmount = this.roundCurrency(balance.estimatedAmount + delta);
        break;
      case 'CONFIRMED':
        balance.confirmedAmount = this.roundCurrency(balance.confirmedAmount + delta);
        break;
      case 'REVERTED':
        balance.revertedAmount = this.roundCurrency(balance.revertedAmount + delta);
        break;
      default:
        break;
    }
  }

  private ensureInfluencerBalance(influencerId: string, tenantId: string): InfluencerBalanceRecord {
    const key = this.getBalanceKey(influencerId, tenantId);
    const existing = this.balances.get(key);
    if (existing) {
      return existing;
    }

    const balance: InfluencerBalanceRecord = {
      influencerId,
      tenantId,
      estimatedAmount: 0,
      confirmedAmount: 0,
      revertedAmount: 0,
      pendingWithdrawalAmount: 0,
      withdrawnAmount: 0,
      adjustmentAmount: 0,
      availableForWithdrawal: 0,
      lastCalculatedAt: new Date()
    };

    this.balances.set(key, balance);
    return balance;
  }

  private getBalanceKey(influencerId: string, tenantId: string) {
    return `${tenantId}:${influencerId}`;
  }

  private recalculateAvailableBalance(balance: InfluencerBalanceRecord) {
    const rawValue =
      balance.confirmedAmount -
      balance.withdrawnAmount -
      balance.pendingWithdrawalAmount;

    balance.availableForWithdrawal = this.roundCurrency(rawValue);
    balance.lastCalculatedAt = new Date();
  }

  private resolveCurrentTierSnapshot(input: {
    campaign: CampaignEntity;
    influencerId: string;
  }): CampaignTierSnapshot {
    const assignment = this.ensureTierAssignment({
      influencerId: input.influencerId,
      campaign: input.campaign
    });

    return assignment.currentTier;
  }

  private ensureTierAssignment(input: {
    influencerId: string;
    campaign: CampaignEntity;
  }): InfluencerTierAssignment {
    const key = this.getTierAssignmentKey(input.campaign.id, input.influencerId);
    const existing = this.tierAssignments.get(key);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const defaultTier = this.resolveDefaultTierSnapshot(input.campaign);
    const historyRecord: TierAssignmentHistoryRecord = {
      id: uuid(),
      influencerId: input.influencerId,
      campaignId: input.campaign.id,
      tierLevel: defaultTier.level,
      tierName: defaultTier.name,
      commissionRate: defaultTier.commissionPercent,
      effectiveFrom: now,
      effectiveTo: undefined,
      windowStart: input.campaign.startDate ?? now,
      windowEnd: now,
      salesVolume: 0,
      reason: 'initial-tier',
      triggeredBy: 'system'
    };

    const assignment: InfluencerTierAssignment = {
      key,
      tenantId: input.campaign.tenantId,
      campaignId: input.campaign.id,
      influencerId: input.influencerId,
      evaluationPeriodDays: input.campaign.tierEvaluationPeriodDays ?? 15,
      currentTier: defaultTier,
      currentWindowStart: now,
      lastEvaluationAt: now,
      history: [historyRecord]
    };

    this.tierAssignments.set(key, assignment);
    this.tierHistory.push(historyRecord);
    return assignment;
  }

  private resolveDefaultTierSnapshot(campaign: CampaignEntity): CampaignTierSnapshot {
    if (!campaign.tiers || campaign.tiers.length === 0) {
      return {
        name: 'Base',
        level: 0,
        commissionPercent: campaign.commissionBase,
        thresholdConfirmedSales: 0
      };
    }

    const sorted = [...campaign.tiers].sort(
      (a, b) => a.thresholdConfirmedSales - b.thresholdConfirmedSales
    );
    const tier = sorted[0];

    return {
      name: tier.name,
      level: tier.level,
      commissionPercent: tier.commissionPercent,
      thresholdConfirmedSales: tier.thresholdConfirmedSales
    };
  }

  private resolveTierForSales(
    campaign: CampaignEntity,
    salesVolume: number
  ): CampaignTierSnapshot {
    if (!campaign.tiers || campaign.tiers.length === 0) {
      return this.resolveDefaultTierSnapshot(campaign);
    }

    const sorted = [...campaign.tiers].sort(
      (a, b) => a.thresholdConfirmedSales - b.thresholdConfirmedSales
    );

    let selected = sorted[0];
    for (const tier of sorted) {
      if (salesVolume >= tier.thresholdConfirmedSales) {
        selected = tier;
      } else {
        break;
      }
    }

    return {
      name: selected.name,
      level: selected.level,
      commissionPercent: selected.commissionPercent,
      thresholdConfirmedSales: selected.thresholdConfirmedSales
    };
  }

  private calculateConfirmedSalesVolume(input: {
    influencerId: string;
    campaignId: string;
    windowStart: Date;
    windowEnd: Date;
  }): number {
    let total = 0;
    for (const commission of this.commissions.values()) {
      if (commission.influencerId !== input.influencerId) {
        continue;
      }
      if (commission.campaignId !== input.campaignId) {
        continue;
      }
      if (commission.state !== 'CONFIRMED') {
        continue;
      }
      if (!commission.confirmedAt) {
        continue;
      }
      if (commission.confirmedAt < input.windowStart || commission.confirmedAt > input.windowEnd) {
        continue;
      }

      total += commission.eligibleAmount;
    }

    return this.roundCurrency(total);
  }

  private getTierAssignmentKey(campaignId: string, influencerId: string) {
    return `${campaignId}:${influencerId}`;
  }

  private calculateCommissionAmount(eligibleAmount: number, commissionRate: number): number {
    const amount = (eligibleAmount * commissionRate) / 100;
    return this.roundCurrency(amount);
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private cloneWithdrawalRequest(entry: WithdrawalRequestRecord): WithdrawalRequestRecord {
    return {
      ...entry,
      requestedAt: new Date(entry.requestedAt),
      processedAt: entry.processedAt ? new Date(entry.processedAt) : undefined,
      documents: entry.documents.map((doc) => ({
        ...doc,
        uploadedAt: new Date(doc.uploadedAt)
      })),
      decisionLog: entry.decisionLog.map((log) => ({
        ...log,
        actedAt: new Date(log.actedAt)
      })),
      reconciliationIds: [...entry.reconciliationIds]
    };
  }

  private clonePaymentRecord(entry: PaymentRecord): PaymentRecord {
    return {
      ...entry,
      paymentDate: new Date(entry.paymentDate),
      createdAt: new Date(entry.createdAt),
      taxWithheld:
        entry.taxWithheld !== undefined ? this.roundCurrency(entry.taxWithheld) : undefined,
      documents: entry.documents.map((doc) => ({
        ...doc,
        uploadedAt: new Date(doc.uploadedAt)
      })),
      appliedAdjustmentIds: [...entry.appliedAdjustmentIds]
    };
  }

  private cloneWithdrawalAdjustment(entry: WithdrawalAdjustmentRecord): WithdrawalAdjustmentRecord {
    return {
      ...entry,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      resolvedAt: entry.resolvedAt ? new Date(entry.resolvedAt) : undefined
    };
  }

  private getPendingAdjustmentTotal(influencerId: string, tenantId: string): number {
    let total = 0;
    for (const adjustment of this.withdrawalAdjustments.values()) {
      if (adjustment.influencerId !== influencerId) {
        continue;
      }
      if (adjustment.tenantId !== tenantId) {
        continue;
      }
      if (adjustment.status !== 'pending') {
        continue;
      }
      total += adjustment.amount;
    }

    return this.roundCurrency(total);
  }

  private refreshBalanceAdjustments(influencerId: string, tenantId: string) {
    const balance = this.ensureInfluencerBalance(influencerId, tenantId);
    balance.adjustmentAmount = this.getPendingAdjustmentTotal(influencerId, tenantId);
    this.recalculateAvailableBalance(balance);
    this.balances.set(this.getBalanceKey(influencerId, tenantId), balance);
  }

  private processReconciliationAdjustments(record: ReconciliationRecord) {
    const summary = record.summary;
    if (!summary || typeof summary !== 'object') {
      return;
    }

    const details = this.resolveReconciliationDetails(summary as Record<string, unknown>);

    const statusMismatchEntries = this.extractReconciliationEntries(details, 'statusMismatch');
    for (const entry of statusMismatchEntries) {
      const orderId = this.resolveReconciliationOrderId(entry);
      if (!orderId) {
        continue;
      }

      const vtexStatus = this.extractReconciliationString(entry, 'vtex');
      const reason = vtexStatus
        ? `Conciliación detectó divergencia de estado VTEX=${vtexStatus}`
        : 'Conciliación detectó divergencia de estado';

      this.createAdjustmentForOrder({
        orderId,
        reason,
        type: 'status_mismatch',
        reconciliationId: record.id
      });
    }

    const missingInVtexEntries = this.extractReconciliationEntries(details, 'missingInVtex');
    for (const entry of missingInVtexEntries) {
      const orderId = this.resolveReconciliationOrderId(entry);
      if (!orderId) {
        continue;
      }

      this.createAdjustmentForOrder({
        orderId,
        reason: 'Pedido existe en plataforma pero falta en VTEX',
        type: 'missing_in_vtex',
        reconciliationId: record.id
      });
    }
  }

  private resolveReconciliationDetails(summary: Record<string, unknown>): Record<string, unknown> {
    const candidate = summary.details ?? summary.discrepancies ?? summary;
    if (candidate && typeof candidate === 'object') {
      return candidate as Record<string, unknown>;
    }
    return {};
  }

  private extractReconciliationEntries(
    details: Record<string, unknown>,
    key: string
  ): Record<string, unknown>[] {
    const raw = details[key];
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : undefined))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  private resolveReconciliationOrderId(entry: Record<string, unknown>): string | undefined {
    const candidates = ['orderId', 'id'];
    for (const key of candidates) {
      const value = entry[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private extractReconciliationString(entry: Record<string, unknown>, key: string): string | undefined {
    const value = entry[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }

  private createAdjustmentForOrder(input: {
    orderId: string;
    reason: string;
    type: WithdrawalAdjustmentType;
    reconciliationId?: string;
  }) {
    if (!input.orderId) {
      return;
    }

    const existingId = this.withdrawalAdjustmentsByOrder.get(input.orderId);
    if (existingId) {
      const existing = this.withdrawalAdjustments.get(existingId);
      if (existing && existing.status === 'pending') {
        existing.reconciliationId = input.reconciliationId ?? existing.reconciliationId;
        existing.reason = input.reason;
        existing.updatedAt = new Date();
        this.withdrawalAdjustments.set(existing.id, existing);
        return;
      }
    }

    const order = this.orders.get(input.orderId);
    if (!order) {
      return;
    }

    const commission = this.commissions.get(order.id);
    if (!commission) {
      return;
    }

    const balance = this.ensureInfluencerBalance(commission.influencerId, commission.tenantId);
    const pendingTotal = this.getPendingAdjustmentTotal(commission.influencerId, commission.tenantId);
    const deficit = Math.max(0, -balance.availableForWithdrawal - pendingTotal);
    if (deficit <= 0) {
      return;
    }

    const amount = this.roundCurrency(Math.min(deficit, commission.commissionAmount));
    if (amount <= 0) {
      return;
    }

    const campaign = order.campaignId ? this.campaigns.get(order.campaignId) : undefined;
    const adjustment: WithdrawalAdjustmentRecord = {
      id: uuid(),
      tenantId: commission.tenantId,
      influencerId: commission.influencerId,
      campaignId: order.campaignId,
      brandId: campaign?.brandId,
      orderId: order.id,
      amount,
      currency: order.currency,
      type: input.type,
      status: 'pending',
      reason: input.reason,
      reconciliationId: input.reconciliationId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.withdrawalAdjustments.set(adjustment.id, adjustment);
    this.withdrawalAdjustmentsByOrder.set(order.id, adjustment.id);
    this.refreshBalanceAdjustments(adjustment.influencerId, adjustment.tenantId);
  }

  private shouldConfirmCommission({
    order,
    thresholdDate
  }: {
    commission: CommissionRecord;
    order: OrderEntity;
    thresholdDate: Date;
  }): boolean {

    if (order.status === 'canceled' || order.status === 'returned') {
      return false;
    }

    if (!order.updatedAt) {
      return false;
    }

    const eligibleStatuses: OrderStatus[] = ['paid', 'invoiced', 'shipped'];
    if (!eligibleStatuses.includes(order.status)) {
      return false;
    }

    return order.updatedAt <= thresholdDate;
  }

  private resolveCommissionState(eventType: RegisterOrderEventInput['eventType']): CommissionState {
    switch (eventType) {
      case 'order-paid':
        return 'CONFIRMED';
      case 'order-canceled':
        return 'REVERTED';
      case 'order-created':
      default:
        return 'ESTIMATED';
    }
  }

  /* Payments & Withdrawals */
  getBrandWithdrawalPolicies(): BrandWithdrawalPolicy[] {
    return Array.from(this.brandWithdrawalPolicies.values()).map((policy) => ({ ...policy }));
  }

  getBrandWithdrawalPolicy(brandId: string): BrandWithdrawalPolicy {
    const policy = this.brandWithdrawalPolicies.get(brandId);
    if (policy) {
      return { ...policy };
    }

    return {
      brandId,
      brandName: brandId,
      minimumAmount: 0,
      currency: 'COP'
    };
  }

  requestWithdrawal(input: RequestWithdrawalInput): WithdrawalRequestRecord {
    const tenantId = input.tenantId ?? 'medipiel';
    const influencer = this.influencers.get(input.influencerId);
    if (!influencer) {
      throw new Error(`Influencer ${input.influencerId} no encontrado`);
    }

    if (influencer.status !== 'approved') {
      throw new Error('El influencer debe estar aprobado para solicitar retiros');
    }

    const policy = this.getBrandWithdrawalPolicy(input.brandId);

    const isAssignedToBrand = influencer.assignedCampaignIds.some((campaignId) => {
      const campaign = this.campaigns.get(campaignId);
      return campaign?.brandId === policy.brandId;
    });

    if (!isAssignedToBrand) {
      throw new Error('El influencer no tiene campañas activas para la marca indicada');
    }

    const balance = this.ensureInfluencerBalance(influencer.id, tenantId);
    const requestedAmount = this.roundCurrency(input.amount);

    if (requestedAmount <= 0) {
      throw new Error('El monto solicitado debe ser mayor a cero');
    }

    if (balance.availableForWithdrawal < policy.minimumAmount) {
      throw new Error('El saldo disponible no alcanza el mínimo de retiro configurado');
    }

    if (requestedAmount > balance.availableForWithdrawal) {
      throw new Error('El monto solicitado excede el saldo disponible');
    }

    const now = new Date();
    const documents = (input.documents ?? []).map<WithdrawalDocument>((doc) => {
      const documentId = uuid();
      this.storeDocumentContent(documentId, doc.url);
      return {
        id: documentId,
        type: doc.type,
        filename: doc.filename,
        url: `secure://vault/${documentId}`,
        notes: doc.notes,
        uploadedAt: now,
        uploadedBy: input.initiatedBy
      };
    });

    const withdrawal: WithdrawalRequestRecord = {
      id: uuid(),
      tenantId,
      influencerId: influencer.id,
      brandId: policy.brandId,
      brandName: policy.brandName,
      requestedAmount,
      currency: policy.currency,
      status: 'pending',
      requestedAt: now,
      notes: input.notes,
      documents,
      decisionLog: [],
      reconciliationIds: [...(input.reconciliationIds ?? [])]
    };

    this.withdrawalRequests.set(withdrawal.id, withdrawal);

    const balanceKey = this.getBalanceKey(influencer.id, tenantId);
    balance.pendingWithdrawalAmount = this.roundCurrency(
      balance.pendingWithdrawalAmount + requestedAmount
    );
    this.recalculateAvailableBalance(balance);
    this.balances.set(balanceKey, balance);

    return this.cloneWithdrawalRequest(withdrawal);
  }

  listWithdrawalRequests(filter?: {
    influencerId?: string;
    status?: WithdrawalStatus[];
    brandId?: string;
  }): WithdrawalRequestRecord[] {
    const statusFilter = filter?.status?.length ? filter.status : undefined;

    return Array.from(this.withdrawalRequests.values())
      .filter((entry) => {
        if (filter?.influencerId && entry.influencerId !== filter.influencerId) {
          return false;
        }
        if (filter?.brandId && entry.brandId !== filter.brandId) {
          return false;
        }
        if (statusFilter && !statusFilter.includes(entry.status)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
      .map((entry) => this.cloneWithdrawalRequest(entry));
  }

  getWithdrawalRequestById(id: string): WithdrawalRequestRecord | undefined {
    const entry = this.withdrawalRequests.get(id);
    return entry ? this.cloneWithdrawalRequest(entry) : undefined;
  }

  decideWithdrawal(input: DecideWithdrawalInput): WithdrawalRequestRecord | undefined {
    const withdrawal = this.withdrawalRequests.get(input.withdrawalId);
    if (!withdrawal) {
      return undefined;
    }

    if (withdrawal.status !== 'pending') {
      return this.cloneWithdrawalRequest(withdrawal);
    }

    const actedAt = new Date();
    withdrawal.status = input.status;
    withdrawal.processedBy = input.processedBy;
    withdrawal.processedAt = actedAt;
    withdrawal.notes = input.notes ?? withdrawal.notes;
    if (input.paymentReference) {
      withdrawal.paymentReference = input.paymentReference;
    }

    const decision: WithdrawalDecisionEntry = {
      status: input.status,
      actedBy: input.processedBy,
      actedAt,
      notes: input.notes
    };
    withdrawal.decisionLog.push(decision);

    if (input.status === 'rejected') {
      const balance = this.ensureInfluencerBalance(withdrawal.influencerId, withdrawal.tenantId);
      balance.pendingWithdrawalAmount = this.roundCurrency(
        Math.max(balance.pendingWithdrawalAmount - withdrawal.requestedAmount, 0)
      );
      this.recalculateAvailableBalance(balance);
      this.balances.set(this.getBalanceKey(withdrawal.influencerId, withdrawal.tenantId), balance);
    }

    this.withdrawalRequests.set(withdrawal.id, withdrawal);
    return this.cloneWithdrawalRequest(withdrawal);
  }

  recordPayment(input: RecordPaymentInput): PaymentRecord {
    let withdrawal = this.withdrawalRequests.get(input.withdrawalId);
    if (!withdrawal) {
      throw new Error(`Solicitud de retiro ${input.withdrawalId} no encontrada`);
    }

    if (withdrawal.status === 'rejected') {
      throw new Error('No se puede registrar un pago para una solicitud rechazada');
    }

    if (withdrawal.status === 'pending') {
      this.decideWithdrawal({
        withdrawalId: withdrawal.id,
        status: 'approved',
        processedBy: input.processedBy,
        notes: 'Aprobación automática antes de registrar pago',
        paymentReference: input.reference
      });
      withdrawal = this.withdrawalRequests.get(input.withdrawalId);
    }

    if (!withdrawal || withdrawal.status !== 'approved') {
      throw new Error('La solicitud debe estar aprobada antes de registrar el pago');
    }

    const amount = this.roundCurrency(input.amount);
    if (Math.abs(amount - withdrawal.requestedAmount) > 0.01) {
      throw new Error('El monto a pagar debe coincidir con la solicitud aprobada');
    }

    const now = new Date();
    const documents = (input.documents ?? []).map<WithdrawalDocument>((doc) => {
      const documentId = uuid();
      this.storeDocumentContent(documentId, doc.url);
      return {
        id: documentId,
        type: doc.type,
        filename: doc.filename,
        url: `secure://vault/${documentId}`,
        notes: doc.notes,
        uploadedAt: now,
        uploadedBy: input.processedBy
      };
    });

    const adjustmentIds = Array.from(new Set(input.adjustmentIds ?? [])).filter(Boolean);

    const payment: PaymentRecord = {
      id: uuid(),
      tenantId: withdrawal.tenantId,
      influencerId: withdrawal.influencerId,
      withdrawalRequestId: withdrawal.id,
      amount,
      currency: withdrawal.currency,
      paymentDate: input.paymentDate,
      method: input.method,
      reference: input.reference,
      voucherUrl: input.voucherUrl,
      taxWithheld: input.taxWithheld ? this.roundCurrency(input.taxWithheld) : undefined,
      processedBy: input.processedBy,
      createdAt: now,
      reconciliationId: input.reconciliationId,
      documents,
      appliedAdjustmentIds: []
    };

    const balance = this.ensureInfluencerBalance(withdrawal.influencerId, withdrawal.tenantId);
    balance.pendingWithdrawalAmount = this.roundCurrency(
      Math.max(balance.pendingWithdrawalAmount - amount, 0)
    );
    balance.withdrawnAmount = this.roundCurrency(balance.withdrawnAmount + amount);
    this.recalculateAvailableBalance(balance);
    this.balances.set(this.getBalanceKey(withdrawal.influencerId, withdrawal.tenantId), balance);

    withdrawal.status = 'paid';
    withdrawal.processedBy = input.processedBy;
    withdrawal.processedAt = now;
    if (input.reference) {
      withdrawal.paymentReference = input.reference;
    }
    withdrawal.decisionLog.push({
      status: 'paid',
      actedBy: input.processedBy,
      actedAt: now,
      notes: `Pago registrado vía ${input.method}`
    });

    if (input.reconciliationId && !withdrawal.reconciliationIds.includes(input.reconciliationId)) {
      withdrawal.reconciliationIds.push(input.reconciliationId);
    }

    this.withdrawalRequests.set(withdrawal.id, withdrawal);

    if (adjustmentIds.length) {
      const applied = new Set<string>();
      for (const adjustmentId of adjustmentIds) {
        const resolved = this.resolveWithdrawalAdjustment(adjustmentId, {
          resolvedBy: input.processedBy,
          paymentId: payment.id,
          resolutionType: 'recovered'
        });
        if (resolved) {
          applied.add(resolved.id);
        }
      }
      payment.appliedAdjustmentIds = Array.from(applied);
    }

    this.payments.set(payment.id, payment);

    return this.clonePaymentRecord(payment);
  }

  listPayments(filter?: { influencerId?: string }): PaymentRecord[] {
    return Array.from(this.payments.values())
      .filter((entry) => {
        if (filter?.influencerId && entry.influencerId !== filter.influencerId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())
      .map((entry) => this.clonePaymentRecord(entry));
  }

  listWithdrawalAdjustments(filter?: {
    influencerId?: string;
    status?: WithdrawalAdjustmentStatus[];
  }): WithdrawalAdjustmentRecord[] {
    const statusFilter = filter?.status?.length ? filter.status : undefined;

    return Array.from(this.withdrawalAdjustments.values())
      .filter((entry) => {
        if (filter?.influencerId && entry.influencerId !== filter.influencerId) {
          return false;
        }
        if (statusFilter && !statusFilter.includes(entry.status)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((entry) => this.cloneWithdrawalAdjustment(entry));
  }

  getWithdrawalAdjustmentById(id: string): WithdrawalAdjustmentRecord | undefined {
    const entry = this.withdrawalAdjustments.get(id);
    return entry ? this.cloneWithdrawalAdjustment(entry) : undefined;
  }

  resolveWithdrawalAdjustment(
    id: string,
    input: {
      resolvedBy: string;
      resolutionType: WithdrawalAdjustmentResolutionType;
      paymentId?: string;
      notes?: string;
    }
  ): WithdrawalAdjustmentRecord | undefined {
    const adjustment = this.withdrawalAdjustments.get(id);
    if (!adjustment) {
      return undefined;
    }

    if (adjustment.status === 'resolved') {
      return this.cloneWithdrawalAdjustment(adjustment);
    }

    adjustment.status = 'resolved';
    adjustment.resolvedAt = new Date();
    adjustment.resolvedBy = input.resolvedBy;
    adjustment.resolutionType = input.resolutionType;
    adjustment.resolvedByPaymentId = input.paymentId ?? adjustment.resolvedByPaymentId;
    adjustment.notes = input.notes ?? adjustment.notes;
    adjustment.updatedAt = new Date();

    this.withdrawalAdjustments.set(id, adjustment);
    this.refreshBalanceAdjustments(adjustment.influencerId, adjustment.tenantId);

    return this.cloneWithdrawalAdjustment(adjustment);
  }

  getPaymentById(id: string): PaymentRecord | undefined {
    const entry = this.payments.get(id);
    return entry ? this.clonePaymentRecord(entry) : undefined;
  }

  addWithdrawalDocument(
    withdrawalId: string,
    document: WithdrawalDocumentInput,
    uploadedBy: string
  ): WithdrawalDocument | undefined {
    const withdrawal = this.withdrawalRequests.get(withdrawalId);
    if (!withdrawal) {
      return undefined;
    }

    const record: WithdrawalDocument = {
      id: uuid(),
      type: document.type,
      filename: document.filename,
      url: document.url,
      notes: document.notes,
      uploadedAt: new Date(),
      uploadedBy
    };

    withdrawal.documents.push(record);
    this.withdrawalRequests.set(withdrawalId, withdrawal);
    return { ...record, uploadedAt: new Date(record.uploadedAt) };
  }

  addPaymentDocument(
    paymentId: string,
    document: WithdrawalDocumentInput,
    uploadedBy: string
  ): WithdrawalDocument | undefined {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return undefined;
    }

    const record: WithdrawalDocument = {
      id: uuid(),
      type: document.type,
      filename: document.filename,
      url: document.url,
      notes: document.notes,
      uploadedBy,
      uploadedAt: new Date()
    };

    payment.documents.push(record);
    this.payments.set(paymentId, payment);
    return { ...record, uploadedAt: new Date(record.uploadedAt) };
  }

  updateInfluencerDetails(
    influencerId: string,
    updates: UpdateInfluencerDetailsInput
  ) {
    const influencer = this.influencers.get(influencerId);
    if (!influencer) {
      return undefined;
    }

    const sanitizedUpdates: Partial<InfluencerEntity> = { ...updates };
    if (updates.bankAccount) {
      sanitizedUpdates.bankAccount = this.persistBankAccount(influencerId, updates.bankAccount);
    }

    const updated: InfluencerEntity = {
      ...influencer,
      ...sanitizedUpdates,
      updatedAt: new Date()
    };

    this.influencers.set(influencerId, updated);
    return updated;
  }

  /* Campaigns */
  listCampaigns(): CampaignEntity[] {
    return Array.from(this.campaigns.values());
  }

  getCampaignById(id: string): CampaignEntity | undefined {
    return this.campaigns.get(id);
  }

  createCampaign(input: CreateCampaignInput): CampaignEntity {
    const now = new Date();
    const campaign: CampaignEntity = {
      id: uuid(),
      tenantId: input.tenantId,
      brandId: input.brandId,
      brandName: input.brandName,
      name: input.name,
      slug: input.slug,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      commissionBase: input.commissionBase,
      commissionBasis: input.commissionBasis,
      eligibleScopeType: input.eligibleScopeType,
      eligibleScopeValues: input.eligibleScopeValues,
      maxDiscountPercent: input.maxDiscountPercent,
      maxUsage: input.maxUsage,
      tierEvaluationPeriodDays: input.tierEvaluationPeriodDays ?? 15,
      tiers: input.tiers ?? [],
      assignedInfluencerIds: [],
      createdAt: now,
      updatedAt: now
    };

    this.campaigns.set(campaign.id, campaign);
    if (!this.brandWithdrawalPolicies.has(input.brandId)) {
      this.brandWithdrawalPolicies.set(input.brandId, {
        brandId: input.brandId,
        brandName: input.brandName,
        minimumAmount: 0,
        currency: 'COP'
      });
    }
    return campaign;
  }

  updateCampaign(input: UpdateCampaignInput) {
    const campaign = this.campaigns.get(input.campaignId);
    if (!campaign) return undefined;

    campaign.description = input.description ?? campaign.description;
    campaign.status = input.status ?? campaign.status;
    campaign.endDate = input.endDate ?? campaign.endDate;
    campaign.maxDiscountPercent =
      input.maxDiscountPercent ?? campaign.maxDiscountPercent;
    campaign.maxUsage = input.maxUsage ?? campaign.maxUsage;
    campaign.tiers = input.tiers ?? campaign.tiers;
    campaign.tierEvaluationPeriodDays =
      input.tierEvaluationPeriodDays ?? campaign.tierEvaluationPeriodDays;
    campaign.updatedAt = new Date();

    return campaign;
  }

  /* Discount codes */
  listDiscountCodes(): DiscountCodeEntity[] {
    return Array.from(this.discountCodes.values());
  }

  createDiscountCode(input: CreateDiscountCodeInput): DiscountCodeEntity {
    const code = this.composeCode(input.prefix ?? 'CODE', input.campaignId, input.influencerId);
    const now = new Date();
    const discount: DiscountCodeEntity = {
      id: uuid(),
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      influencerId: input.influencerId,
      code,
      status: this.calculateInitialStatus(input),
      discountPercent: input.discountPercent,
      startDate: now,
      endDate: input.expiresAt,
      maxUsage: input.maxUsage,
      usageCount: 0,
      conditions: undefined,
      createdAt: now,
      updatedAt: now
    };

    this.discountCodes.set(discount.id, discount);
    this.discountCodesByCode.set(discount.code.toUpperCase(), discount);
    return discount;
  }

  updateDiscountCode(id: string, updates: Partial<DiscountCodeEntity>) {
    const discount = this.discountCodes.get(id);
    if (!discount) {
      return undefined;
    }

    const updated: DiscountCodeEntity = {
      ...discount,
      ...updates,
      updatedAt: new Date()
    };

    this.discountCodes.set(id, updated);
    this.discountCodesByCode.set(updated.code.toUpperCase(), updated);
    return updated;
  }

  findDiscountCodeByCode(code: string): DiscountCodeEntity | undefined {
    return this.discountCodesByCode.get(code.toUpperCase());
  }

  getDiscountCodeById(id: string): DiscountCodeEntity | undefined {
    return this.discountCodes.get(id);
  }

  listDiscountCodesByInfluencer(influencerId: string): DiscountCodeEntity[] {
    return Array.from(this.discountCodes.values()).filter(
      (discount) => discount.influencerId === influencerId
    );
  }

  recordWebhookDelivery(entry: WebhookDeliveryLog) {
    this.webhookLogs.push(entry);
  }

  listWebhookDeliveries(): WebhookDeliveryLog[] {
    return [...this.webhookLogs];
  }

  private calculateInitialStatus(input: CreateDiscountCodeInput): DiscountCodeStatus {
    const campaign = this.campaigns.get(input.campaignId);
    if (!campaign) {
      return 'pending';
    }

    return campaign.status === 'active' ? 'active' : 'pending';
  }

  private composeCode(prefix: string, campaignId: string, influencerId: string): string {
    const shortCampaign = campaignId.split('-')[0].toUpperCase().slice(0, 4);
    const shortInfluencer = influencerId.split('-')[0].toUpperCase().slice(0, 4);
    return `${prefix.toUpperCase()}-${shortCampaign}${shortInfluencer}`;
  }

  private calculateEligibleAmount(input: {
    campaign?: CampaignEntity;
    items: OrderItemEntity[];
    taxAmount?: number;
    shippingAmount?: number;
    includeShipping?: boolean;
  }): number {
    const { campaign, items, taxAmount, shippingAmount, includeShipping } = input;

    const eligibleItems = items.filter((item) => this.isItemEligible(campaign, item));
    const subtotal = eligibleItems.reduce((acc, item) => {
      const lineAmount = item.price * item.quantity - (item.discount ?? 0);
      return acc + lineAmount;
    }, 0);

    let total = subtotal;
    if (campaign?.commissionBasis === 'post_tax') {
      total += taxAmount ?? 0;
    }

    if (includeShipping) {
      total += shippingAmount ?? 0;
    }

    return Math.max(total, 0);
  }

  private isItemEligible(campaign: CampaignEntity | undefined, item: OrderItemEntity): boolean {
    if (!campaign) {
      return true;
    }

    if (!campaign.eligibleScopeValues || campaign.eligibleScopeValues.length === 0) {
      return true;
    }

    if (campaign.eligibleScopeType === 'sku') {
      return campaign.eligibleScopeValues.includes(item.skuId);
    }

    const categoryCandidates = [item.categoryId, item.categoryName].filter(Boolean) as string[];
    return categoryCandidates.some((value) => campaign.eligibleScopeValues?.includes(value));
  }
}
