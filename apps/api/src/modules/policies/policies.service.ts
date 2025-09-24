/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Injectable } from '@nestjs/common';

import type { PolicyType, PolicyVersionRecord } from '../../common/interfaces/policy.interface';
import { InMemoryDatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

import { PublishPolicyVersionDto } from './dto/publish-policy-version.dto';

@Injectable()
export class PoliciesService {
  constructor(
    private readonly database: InMemoryDatabaseService,
    private readonly notifications: NotificationsService
  ) {}

  listActivePolicies(): PolicyVersionRecord[] {
    return this.database.getActivePolicyVersions();
  }

  getActivePolicy(policyType: PolicyType): PolicyVersionRecord | undefined {
    return this.database.getActivePolicyVersionByType(policyType);
  }

  listInfluencerConsents(influencerId: string) {
    return this.database.listInfluencerConsents(influencerId);
  }

  generateConsentCertificate(influencerId: string, policyVersionId: string) {
    return this.database.generateConsentCertificate(influencerId, policyVersionId);
  }

  publishPolicyVersion(policyType: PolicyType, dto: PublishPolicyVersionDto, actor?: string) {
    const record = this.database.publishPolicyVersion({
      policyType,
      version: dto.version,
      documentUrl: dto.documentUrl,
      checksum: dto.checksum,
      title: dto.title,
      notes: dto.notes,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined
    });

    this.notifications.emit({
      type: 'policy.updated',
      recipient: 'global',
      payload: {
        policyType: record.policyType,
        version: record.version,
        title: record.title,
        documentUrl: record.documentUrl,
        checksum: record.checksum,
        publishedAt: record.publishedAt.toISOString(),
        publishedBy: actor ?? 'system'
      }
    });

    return record;
  }
}
