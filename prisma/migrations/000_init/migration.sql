-- Initial migration for Medipiel marketing de afiliados platform
-- This script is handcrafted to match prisma/schema.prisma and sets up
-- core tables, enums and indexes required for the MVP data model.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums ------------------------------------------------------------------
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
CREATE TYPE "PolicyType" AS ENUM ('TERMS', 'PRIVACY', 'HABEAS_DATA');
CREATE TYPE "InfluencerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE "CommissionBasis" AS ENUM ('PRE_TAX', 'POST_TAX');
CREATE TYPE "EligibleScopeType" AS ENUM ('SKU', 'CATEGORY');
CREATE TYPE "CampaignInfluencerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "DiscountCodeStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PAID', 'INVOICED', 'SHIPPED', 'CANCELED', 'RETURNED');
CREATE TYPE "CommissionState" AS ENUM ('ESTIMATED', 'CONFIRMED', 'REVERTED');
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');
CREATE TYPE "ReconciliationType" AS ENUM ('DAILY', 'FORTNIGHTLY', 'ADHOC');
CREATE TYPE "ReconciliationStatus" AS ENUM ('SUCCESS', 'WARN', 'FAILED');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'SUCCESS', 'FAILED');
CREATE TYPE "ScheduledJobStatus" AS ENUM ('IDLE', 'RUNNING', 'FAILED', 'DISABLED');

-- Core tables -------------------------------------------------------------
CREATE TABLE "Tenant" (
  "id" UUID PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX "User_tenant_idx" ON "User" ("tenantId");

CREATE TABLE "Role" (
  "id" UUID PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE "UserRole" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "roleId" UUID NOT NULL REFERENCES "Role"("id") ON DELETE CASCADE,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "roleId", "tenantId")
);
CREATE INDEX "UserRole_tenant_idx" ON "UserRole" ("tenantId");

CREATE TABLE "Brand" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
  "ownerUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "logoUrl" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "slug")
);
CREATE INDEX "Brand_tenant_idx" ON "Brand" ("tenantId");

CREATE TABLE "Influencer" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "socialLinks" JSONB,
  "bankAccount" JSONB,
  "taxProfile" TEXT,
  "status" "InfluencerStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  UNIQUE ("tenantId", "documentType", "documentNumber")
);
CREATE INDEX "Influencer_tenant_idx" ON "Influencer" ("tenantId");
CREATE INDEX "Influencer_email_idx" ON "Influencer" ("email");

CREATE TABLE "PolicyVersion" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "policyType" "PolicyType" NOT NULL,
  "version" TEXT NOT NULL,
  "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "documentUrl" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "policyType", "version")
);

CREATE TABLE "LegalConsent" (
  "id" UUID PRIMARY KEY,
  "influencerId" UUID NOT NULL REFERENCES "Influencer"("id") ON DELETE CASCADE,
  "policyVersionId" UUID NOT NULL REFERENCES "PolicyVersion"("id") ON DELETE CASCADE,
  "acceptedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "consentHash" TEXT NOT NULL,
  "acceptedBy" TEXT
);
CREATE INDEX "LegalConsent_policy_idx" ON "LegalConsent" ("policyVersionId");
CREATE INDEX "LegalConsent_influencer_idx" ON "LegalConsent" ("influencerId");

CREATE TABLE "Campaign" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "brandId" UUID NOT NULL REFERENCES "Brand"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endDate" TIMESTAMP WITH TIME ZONE,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "commissionBase" NUMERIC(5,2) NOT NULL,
  "commissionBasis" "CommissionBasis" NOT NULL DEFAULT 'PRE_TAX',
  "maxDiscountPercent" NUMERIC(5,2),
  "maxUsage" INTEGER,
  "minOrderValue" NUMERIC(10,2),
  "confirmationWindowDays" INTEGER NOT NULL DEFAULT 15,
  "stackingRules" JSONB,
  "eligibleScopeType" "EligibleScopeType" NOT NULL DEFAULT 'SKU',
  "eligibleScopeValues" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE ("brandId", "slug")
);
CREATE INDEX "Campaign_tenant_idx" ON "Campaign" ("tenantId");
CREATE INDEX "Campaign_brand_idx" ON "Campaign" ("brandId");

CREATE TABLE "CampaignTier" (
  "id" UUID PRIMARY KEY,
  "campaignId" UUID NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "thresholdConfirmedSales" NUMERIC(12,2) NOT NULL,
  "commissionPercent" NUMERIC(5,2) NOT NULL,
  "evaluationPeriodDays" INTEGER NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE ("campaignId", "level")
);

CREATE TABLE "CampaignInfluencer" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "campaignId" UUID NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "influencerId" UUID NOT NULL REFERENCES "Influencer"("id") ON DELETE CASCADE,
  "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "assignedBy" TEXT,
  "status" "CampaignInfluencerStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  UNIQUE ("campaignId", "influencerId")
);
CREATE INDEX "CampaignInfluencer_tenant_idx" ON "CampaignInfluencer" ("tenantId");

CREATE TABLE "DiscountCode" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "campaignId" UUID NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "influencerId" UUID NOT NULL REFERENCES "Influencer"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "prefix" TEXT,
  "suffix" TEXT,
  "status" "DiscountCodeStatus" NOT NULL DEFAULT 'PENDING',
  "discountPercent" NUMERIC(5,2),
  "startDate" TIMESTAMP WITH TIME ZONE,
  "endDate" TIMESTAMP WITH TIME ZONE,
  "maxUsage" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "conditions" JSONB,
  "vtexCouponId" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "code")
);
CREATE INDEX "DiscountCode_campaign_idx" ON "DiscountCode" ("campaignId");
CREATE INDEX "DiscountCode_influencer_idx" ON "DiscountCode" ("influencerId");

CREATE TABLE "Order" (
  "id" TEXT PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "status" "OrderStatus" NOT NULL,
  "placedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "paidAt" TIMESTAMP WITH TIME ZONE,
  "currency" TEXT NOT NULL,
  "totalAmount" NUMERIC(12,2) NOT NULL,
  "customerEmail" TEXT,
  "rawPayload" JSONB,
  "originChannel" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX "Order_tenant_idx" ON "Order" ("tenantId");
CREATE INDEX "Order_status_idx" ON "Order" ("status");

CREATE TABLE "OrderLine" (
  "id" UUID PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "skuId" TEXT NOT NULL,
  "skuRef" TEXT,
  "title" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" NUMERIC(10,2) NOT NULL,
  "totalPrice" NUMERIC(12,2) NOT NULL,
  "taxAmount" NUMERIC(10,2),
  "category" TEXT,
  "eligibleForCommission" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX "OrderLine_order_idx" ON "OrderLine" ("orderId");

CREATE TABLE "OrderAttribution" (
  "id" UUID PRIMARY KEY,
  "orderId" TEXT NOT NULL UNIQUE REFERENCES "Order"("id") ON DELETE CASCADE,
  "discountCodeId" UUID NOT NULL REFERENCES "DiscountCode"("id") ON DELETE CASCADE,
  "influencerId" UUID NOT NULL REFERENCES "Influencer"("id") ON DELETE CASCADE,
  "campaignId" UUID NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "attributedAmount" NUMERIC(12,2) NOT NULL,
  "eligibleAmount" NUMERIC(12,2) NOT NULL,
  "stackingDetails" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX "OrderAttribution_code_idx" ON "OrderAttribution" ("discountCodeId");
CREATE INDEX "OrderAttribution_influencer_idx" ON "OrderAttribution" ("influencerId");
CREATE INDEX "OrderAttribution_campaign_idx" ON "OrderAttribution" ("campaignId");

CREATE TABLE "CommissionTransaction" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "orderAttributionId" UUID NOT NULL REFERENCES "OrderAttribution"("id") ON DELETE CASCADE,
  "influencerId" UUID NOT NULL REFERENCES "Influencer"("id") ON DELETE CASCADE,
  "campaignId" UUID NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "tierLevel" INTEGER,
  "state" "CommissionState" NOT NULL DEFAULT 'ESTIMATED',
  "grossAmount" NUMERIC(12,2) NOT NULL,
  "netAmount" NUMERIC(12,2) NOT NULL,
  "calculatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "confirmedAt" TIMESTAMP WITH TIME ZONE,
  "revertedAt" TIMESTAMP WITH TIME ZONE,
  "reason" TEXT,
  "metadata" JSONB
);
CREATE INDEX "CommissionTransaction_tenant_idx" ON "CommissionTransaction" ("tenantId");
CREATE INDEX "CommissionTransaction_order_idx" ON "CommissionTransaction" ("orderId");
CREATE INDEX "CommissionTransaction_influencer_idx" ON "CommissionTransaction" ("influencerId");
CREATE INDEX "CommissionTransaction_campaign_idx" ON "CommissionTransaction" ("campaignId");

CREATE TABLE "InfluencerBalance" (
  "influencerId" UUID PRIMARY KEY REFERENCES "Influencer"("id") ON DELETE CASCADE,
  "estimatedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "confirmedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "revertedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "availableForWithdrawal" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "lastCalculatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE "WithdrawalRequest" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "influencerId" UUID NOT NULL REFERENCES "Influencer"("id") ON DELETE CASCADE,
  "requestedAmount" NUMERIC(12,2) NOT NULL,
  "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMP WITH TIME ZONE,
  "processedBy" TEXT,
  "paymentReference" TEXT,
  "attachments" JSONB,
  "notes" TEXT
);
CREATE INDEX "WithdrawalRequest_tenant_idx" ON "WithdrawalRequest" ("tenantId");
CREATE INDEX "WithdrawalRequest_influencer_idx" ON "WithdrawalRequest" ("influencerId");

CREATE TABLE "Payment" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "withdrawalRequestId" UUID UNIQUE REFERENCES "WithdrawalRequest"("id") ON DELETE SET NULL,
  "influencerId" UUID NOT NULL REFERENCES "Influencer"("id") ON DELETE CASCADE,
  "amount" NUMERIC(12,2) NOT NULL,
  "paymentDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "voucherUrl" TEXT,
  "taxWithheld" NUMERIC(12,2),
  "processedBy" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX "Payment_tenant_idx" ON "Payment" ("tenantId");
CREATE INDEX "Payment_influencer_idx" ON "Payment" ("influencerId");

CREATE TABLE "ReconciliationLog" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "runDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "type" "ReconciliationType" NOT NULL,
  "status" "ReconciliationStatus" NOT NULL,
  "discrepanciesFound" INTEGER NOT NULL DEFAULT 0,
  "reportUrl" TEXT,
  "summary" JSONB,
  "triggeredBy" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX "Reconciliation_tenant_run_idx" ON "ReconciliationLog" ("tenantId", "runDate");

CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "performedBy" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "role" TEXT,
  "payloadBefore" JSONB,
  "payloadAfter" JSONB,
  "ipAddress" TEXT,
  "performedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX "AuditLog_tenant_entity_idx" ON "AuditLog" ("tenantId", "entity");

CREATE TABLE "NotificationQueue" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP WITH TIME ZONE,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX "NotificationQueue_tenant_status_idx" ON "NotificationQueue" ("tenantId", "status");

CREATE TABLE "WebhookDeliveryLog" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "orderId" TEXT REFERENCES "Order"("id") ON DELETE SET NULL,
  "eventType" TEXT NOT NULL,
  "status" "WebhookStatus" NOT NULL,
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP WITH TIME ZONE,
  "responseCode" INTEGER,
  "responseBody" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX "WebhookDeliveryLog_tenant_event_idx" ON "WebhookDeliveryLog" ("tenantId", "eventType");

CREATE TABLE "ScheduledJob" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "schedule" TEXT NOT NULL,
  "status" "ScheduledJobStatus" NOT NULL DEFAULT 'IDLE',
  "lastRunAt" TIMESTAMP WITH TIME ZONE,
  "lastDurationMs" INTEGER,
  "lastError" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "name")
);

-- Seed data placeholders --------------------------------------------------
-- Insert roles base (Admin Dentsu, Admin Marca, Gestor, Finance, Auditor, Influencer)
INSERT INTO "Role" ("id", "name") VALUES
  (gen_random_uuid(), 'admin_dentsu'),
  (gen_random_uuid(), 'admin_marca'),
  (gen_random_uuid(), 'gestor_afiliados'),
  (gen_random_uuid(), 'finance'),
  (gen_random_uuid(), 'auditor'),
  (gen_random_uuid(), 'influencer');
