import { Injectable } from '@nestjs/common';

import type {
  CommissionAuditEntry,
  CommissionRecord,
  CommissionSettlementSummary,
  InfluencerBalanceRecord,
  ReconciliationRecord,
  TierAssignmentHistoryRecord,
  TierEvaluationResult
} from '../../common/interfaces/order.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InMemoryDatabaseService } from '../../database/database.service';

@Injectable()
export class CommissionsService {
  constructor(private readonly database: InMemoryDatabaseService) {}

  summary() {
    const commissions = this.database.listCommissions();
    return commissions.reduce(
      (acc, commission) => {
        switch (commission.state) {
          case 'CONFIRMED':
            acc.confirmedAmount += commission.commissionAmount;
            break;
          case 'ESTIMATED':
            acc.estimatedAmount += commission.commissionAmount;
            break;
          case 'REVERTED':
            acc.reversedAmount += commission.commissionAmount;
            break;
          default:
            break;
        }
        return acc;
      },
      {
        confirmedAmount: 0,
        estimatedAmount: 0,
        reversedAmount: 0
      }
    );
  }

  list(): CommissionRecord[] {
    return this.database.listCommissions();
  }

  reconciliations(): ReconciliationRecord[] {
    return this.database.listReconciliations();
  }

  balances(filter?: { influencerId?: string }): InfluencerBalanceRecord[] {
    const balances = this.database.listInfluencerBalances();
    if (!filter?.influencerId) {
      return balances;
    }

    return balances.filter((balance) => balance.influencerId === filter.influencerId);
  }

  auditTrail(): CommissionAuditEntry[] {
    return this.database.listCommissionAuditTrail();
  }

  tierHistory(filters?: { campaignId?: string; influencerId?: string }): TierAssignmentHistoryRecord[] {
    return this.database.listTierHistory(filters);
  }

  evaluateTiers(input: { evaluationDate?: string; triggeredBy?: string }): TierEvaluationResult[] {
    return this.database.evaluateTiers({
      evaluationDate: input.evaluationDate ? new Date(input.evaluationDate) : undefined,
      triggeredBy: input.triggeredBy
    });
  }

  runSettlement(input: {
    evaluationDate?: string;
    waitingPeriodDays?: number;
    triggeredBy?: string;
  }): CommissionSettlementSummary {
    return this.database.runSettlement({
      evaluationDate: input.evaluationDate ? new Date(input.evaluationDate) : undefined,
      waitingPeriodDays: input.waitingPeriodDays,
      triggeredBy: input.triggeredBy
    });
  }
}
