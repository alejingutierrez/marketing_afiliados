import type { AppRole } from './roles.enum';

export type InfluencerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface LegalConsentRecord {
  policyVersionId: string;
  acceptedAt: Date;
  consentHash: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface InfluencerDocument {
  id: string;
  filename: string;
  contentType: string;
  size?: number;
  checksum?: string;
  url?: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

export interface InfluencerEntity {
  id: string;
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
  bankAccount?: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    accountType?: string;
    last4?: string;
  };
  taxProfile?: string;
  status: InfluencerStatus;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  consents: LegalConsentRecord[];
  documents?: InfluencerDocument[];
  assignedCampaignIds: string[];
  roles: AppRole[];
}
