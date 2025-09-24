import { Injectable, NotFoundException } from '@nestjs/common';

import type { InfluencerEntity } from '../../common/interfaces/influencer.interface';
import { AppRole } from '../../common/interfaces/roles.enum';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InMemoryDatabaseService } from '../../database/database.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { VtexService } from '../vtex/vtex.service';

import type { RegisterInfluencerDto } from './dto/register-influencer.dto';
import type { UpdateInfluencerStatusDto } from './dto/update-influencer-status.dto';
import type { UpdateInfluencerDto } from './dto/update-influencer.dto';

@Injectable()
export class InfluencersService {
  constructor(
    private readonly database: InMemoryDatabaseService,
    private readonly vtexService: VtexService
  ) {}

  registerPublicInfluencer(dto: RegisterInfluencerDto): InfluencerEntity {
    const influencer = this.database.createInfluencer({
      tenantId: 'medipiel',
      firstName: dto.firstName,
      lastName: dto.lastName,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      city: dto.city,
      country: dto.country,
      socialLinks: dto.socialLinks,
      bankAccount: dto.bankAccount,
      taxProfile: dto.taxProfile,
      consent: {
        policyVersionId: dto.policyVersionId,
        acceptedAt: new Date(),
        consentHash: dto.consentHash,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent
      },
      documents: dto.documents?.map((document) => ({
        filename: document.filename,
        contentType: document.contentType,
        base64Content: document.base64Content,
        checksum: document.checksum,
        uploadedBy: dto.email
      }))
    });

    return influencer;
  }

  listInfluencers(): InfluencerEntity[] {
    return this.database.listInfluencers();
  }

  getInfluencer(id: string): InfluencerEntity {
    const influencer = this.database.getInfluencerById(id);
    if (!influencer) {
      throw new NotFoundException(`Influencer ${id} no encontrado`);
    }

    return influencer;
  }

  async updateStatus(id: string, dto: UpdateInfluencerStatusDto): Promise<InfluencerEntity> {
    const updated = this.database.updateInfluencerStatus({
      influencerId: id,
      status: dto.status,
      rejectionReason: dto.rejectionReason
    });

    if (!updated) {
      throw new NotFoundException(`Influencer ${id} no encontrado`);
    }

    await this.vtexService.handleInfluencerStatusChange(id, updated.status);

    return updated;
  }

  updateInfluencer(id: string, dto: UpdateInfluencerDto): InfluencerEntity {
    const updated = this.database.updateInfluencerDetails(id, {
      phone: dto.phone,
      address: dto.address,
      city: dto.city,
      country: dto.country,
      bankAccount: dto.bankAccount,
      taxProfile: dto.taxProfile
    });

    if (!updated) {
      throw new NotFoundException(`Influencer ${id} no encontrado`);
    }

    return updated;
  }

  assignToCampaign(influencerId: string, campaignId: string) {
    const result = this.database.assignInfluencerToCampaign(influencerId, campaignId);
    if (!result) {
      throw new NotFoundException('Influencer o campaña no encontrados');
    }

    return result;
  }

  isPrivilegedRole(roles: AppRole[]): boolean {
    return roles.some((role) => role !== AppRole.INFLUENCER);
  }
}
