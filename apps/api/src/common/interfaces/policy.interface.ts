export const POLICY_TYPES = ['terms', 'privacy', 'habeas_data'] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export interface PolicyVersionRecord {
  id: string;
  tenantId: string;
  policyType: PolicyType;
  version: string;
  documentUrl: string;
  checksum: string;
  publishedAt: Date;
  isActive: boolean;
  title?: string;
  createdAt: Date;
  notes?: string;
}
