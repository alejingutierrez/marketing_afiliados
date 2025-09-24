/* eslint-disable @typescript-eslint/consistent-type-imports */
import { BadRequestException, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { POLICY_TYPES } from '../../common/interfaces/policy.interface';
import type { PolicyType, PolicyVersionRecord } from '../../common/interfaces/policy.interface';

import { PoliciesService } from './policies.service';

function serializePolicy(policy: PolicyVersionRecord) {
  return {
    ...policy,
    publishedAt: policy.publishedAt.toISOString(),
    createdAt: policy.createdAt.toISOString()
  };
}

function isPolicyType(value: string): value is PolicyType {
  return (POLICY_TYPES as readonly string[]).includes(value);
}

@ApiTags('policies')
@Controller('public/policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  listActivePolicies() {
    return this.policiesService.listActivePolicies().map(serializePolicy);
  }

  @Get(':policyType')
  getActivePolicy(@Param('policyType') policyTypeParam: string) {
    if (!isPolicyType(policyTypeParam)) {
      throw new BadRequestException(`Tipo de política no soportado: ${policyTypeParam}`);
    }
    const policy = this.policiesService.getActivePolicy(policyTypeParam);
    if (!policy) {
      throw new NotFoundException(`No hay versión activa para ${policyTypeParam}`);
    }
    return serializePolicy(policy);
  }
}
