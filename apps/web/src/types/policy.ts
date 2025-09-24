export type PolicyType = 'terms' | 'privacy' | 'habeas_data';

export interface PolicyVersion {
  id: string;
  tenantId?: string;
  policyType: PolicyType;
  version: string;
  documentUrl: string;
  checksum: string;
  publishedAt: string;
  createdAt?: string;
  isActive: boolean;
  title?: string;
  notes?: string;
}
