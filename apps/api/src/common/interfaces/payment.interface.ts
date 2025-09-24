export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export type WithdrawalDocumentType =
  | 'withholding_certificate'
  | 'invoice'
  | 'transfer_receipt'
  | 'other';

export interface WithdrawalDocument {
  id: string;
  type: WithdrawalDocumentType;
  filename: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
  notes?: string;
}

export interface WithdrawalDecisionEntry {
  status: Exclude<WithdrawalStatus, 'pending'>;
  actedBy: string;
  actedAt: Date;
  notes?: string;
}

export interface WithdrawalRequestRecord {
  id: string;
  tenantId: string;
  influencerId: string;
  brandId: string;
  brandName: string;
  requestedAmount: number;
  currency: string;
  status: WithdrawalStatus;
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  paymentReference?: string;
  notes?: string;
  documents: WithdrawalDocument[];
  decisionLog: WithdrawalDecisionEntry[];
  reconciliationIds: string[];
}

export interface PaymentRecord {
  id: string;
  tenantId: string;
  influencerId: string;
  withdrawalRequestId?: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  method: string;
  reference?: string;
  voucherUrl?: string;
  taxWithheld?: number;
  processedBy: string;
  createdAt: Date;
  reconciliationId?: string;
  documents: WithdrawalDocument[];
  appliedAdjustmentIds: string[];
}

export interface BrandWithdrawalPolicy {
  brandId: string;
  brandName: string;
  minimumAmount: number;
  currency: string;
  waitingPeriodDays?: number;
}

export type WithdrawalAdjustmentStatus = 'pending' | 'resolved';

export type WithdrawalAdjustmentType =
  | 'status_mismatch'
  | 'missing_in_vtex'
  | 'manual';

export type WithdrawalAdjustmentResolutionType = 'recovered' | 'written_off';

export interface WithdrawalAdjustmentRecord {
  id: string;
  tenantId: string;
  influencerId: string;
  campaignId?: string;
  brandId?: string;
  orderId?: string;
  amount: number;
  currency: string;
  type: WithdrawalAdjustmentType;
  status: WithdrawalAdjustmentStatus;
  reason: string;
  reconciliationId?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolvedByPaymentId?: string;
  resolutionType?: WithdrawalAdjustmentResolutionType;
  notes?: string;
}
