import { Injectable } from '@nestjs/common';

import type {
  CommissionAuditEntry,
  TierAssignmentHistoryRecord
} from '../../common/interfaces/order.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InMemoryDatabaseService } from '../../database/database.service';

@Injectable()
export class AuditService {
  constructor(private readonly database: InMemoryDatabaseService) {}

  logs(): {
    commissionTrail: CommissionAuditEntry[];
    tierHistory: TierAssignmentHistoryRecord[];
  } {
    return {
      commissionTrail: this.database.listCommissionAuditTrail(),
      tierHistory: this.database.listTierHistory()
    };
  }
}
