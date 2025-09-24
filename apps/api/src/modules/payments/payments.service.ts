/* eslint-disable import/order */
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';

import type {
  BrandWithdrawalPolicy,
  WithdrawalAdjustmentStatus,
  WithdrawalStatus
} from '../../common/interfaces/payment.interface';
import type { AuthenticatedUserPayload } from '../../common/interfaces/user.interface';
import type { CreateWithdrawalRequestDto, WithdrawalDocumentDto } from './dto/create-withdrawal-request.dto';
import type { DecideWithdrawalDto } from './dto/decide-withdrawal.dto';
import type { ListAdjustmentsQueryDto } from './dto/list-adjustments-query.dto';
import type { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import type { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import type { AddDocumentDto, RecordPaymentDto } from './dto/record-payment.dto';
import type { ResolveAdjustmentDto } from './dto/resolve-adjustment.dto';

import { AppRole } from '../../common/interfaces/roles.enum';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { InMemoryDatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
/* eslint-enable import/order */

type RequestWithdrawalArgs = Parameters<InMemoryDatabaseService['requestWithdrawal']>[0];
type WithdrawalFilters = Parameters<InMemoryDatabaseService['listWithdrawalRequests']>[0];
type PaymentFilters = Parameters<InMemoryDatabaseService['listPayments']>[0];
type AdjustmentFilters = Parameters<InMemoryDatabaseService['listWithdrawalAdjustments']>[0];

const ALLOWED_WITHDRAWAL_STATUSES: WithdrawalStatus[] = ['pending', 'approved', 'rejected', 'paid'];
const ALLOWED_ADJUSTMENT_STATUSES: WithdrawalAdjustmentStatus[] = ['pending', 'resolved'];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly database: InMemoryDatabaseService,
    private readonly notifications: NotificationsService
  ) {}

  listPolicies(): BrandWithdrawalPolicy[] {
    return this.database.getBrandWithdrawalPolicies();
  }

  createWithdrawal(dto: CreateWithdrawalRequestDto, user: AuthenticatedUserPayload) {
    const payload: RequestWithdrawalArgs = {
      influencerId: dto.influencerId,
      brandId: dto.brandId,
      amount: dto.amount,
      initiatedBy: user.email ?? user.sub,
      notes: dto.notes,
      documents: this.mapDocuments(dto.documents),
      tenantId: user.tenantId,
      reconciliationIds: dto.reconciliationIds
    };

    try {
      const withdrawal = this.database.requestWithdrawal(payload);
      this.notifications.emit({
        type: 'withdrawal.requested',
        recipient: 'finance@medipiel.co',
        payload: {
          withdrawalId: withdrawal.id,
          influencerId: withdrawal.influencerId,
          brandId: withdrawal.brandId,
          amount: withdrawal.requestedAmount
        }
      });

      return withdrawal;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  listWithdrawals(options: {
    filter: ListWithdrawalsQueryDto;
    requester: AuthenticatedUserPayload;
  }) {
    const { filter, requester } = options;
    const filters: WithdrawalFilters = {};

    const statusFilter = this.parseStatusFilter(filter.status);
    if (statusFilter.length > 0) {
      filters.status = statusFilter;
    }

    if (filter.brandId) {
      filters.brandId = filter.brandId;
    }

    if (filter.influencerId) {
      filters.influencerId = filter.influencerId;
    }

    if (this.isInfluencer(requester)) {
      if (!filters.influencerId) {
        throw new BadRequestException(
          'Los usuarios influencer deben indicar su identificador para listar retiros'
        );
      }
    }

    return this.database.listWithdrawalRequests(filters);
  }

  decideWithdrawal(id: string, dto: DecideWithdrawalDto, user: AuthenticatedUserPayload) {
    if (!this.canManagePayments(user)) {
      throw new ForbiddenException('No tiene permisos para gestionar retiros');
    }

    try {
      const result = this.database.decideWithdrawal({
        withdrawalId: id,
        status: dto.status,
        processedBy: user.email ?? user.sub,
        notes: dto.notes,
        paymentReference: dto.paymentReference
      });

      if (!result) {
        throw new BadRequestException('Solicitud de retiro no encontrada');
      }

      this.notifications.emit({
        type: `withdrawal.${dto.status}`,
        recipient: `influencer:${result.influencerId}`,
        payload: {
          withdrawalId: result.id,
          status: result.status,
          actedBy: user.email ?? user.sub
        }
      });

      return result;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  recordPayment(id: string, dto: RecordPaymentDto, user: AuthenticatedUserPayload) {
    if (!this.canManagePayments(user)) {
      throw new ForbiddenException('No tiene permisos para registrar pagos');
    }

    try {
      const payment = this.database.recordPayment({
        withdrawalId: id,
        amount: dto.amount,
        method: dto.method,
        paymentDate: new Date(dto.paymentDate),
        processedBy: user.email ?? user.sub,
      reference: dto.reference,
      voucherUrl: dto.voucherUrl,
      taxWithheld: dto.taxWithheld,
      reconciliationId: dto.reconciliationId,
      documents: this.mapDocuments(dto.documents),
      adjustmentIds: dto.adjustmentIds
    });

      const withdrawal = this.database.getWithdrawalRequestById(id);
      this.notifications.emit({
        type: 'payment.recorded',
        recipient: `influencer:${payment.influencerId}`,
        payload: {
          paymentId: payment.id,
          amount: payment.amount,
          method: payment.method,
          withdrawalId: payment.withdrawalRequestId,
          status: withdrawal?.status ?? 'paid'
        }
      });

      return payment;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  listPayments(options: { filter: ListPaymentsQueryDto; requester: AuthenticatedUserPayload }) {
    const { filter, requester } = options;
    const filters: PaymentFilters = {};

    if (filter.influencerId) {
      filters.influencerId = filter.influencerId;
    }

    if (this.isInfluencer(requester)) {
      if (!filters.influencerId) {
        throw new BadRequestException(
          'Los usuarios influencer deben indicar su identificador para consultar pagos'
        );
      }
    }

    return this.database.listPayments(filters);
  }

  listAdjustments(options: {
    filter: ListAdjustmentsQueryDto;
    requester: AuthenticatedUserPayload;
  }) {
    const { filter, requester } = options;
    const filters: AdjustmentFilters = {};

    const statusFilter = this.parseAdjustmentStatusFilter(filter.status);
    if (statusFilter.length > 0) {
      filters.status = statusFilter;
    }

    if (filter.influencerId) {
      filters.influencerId = filter.influencerId;
    }

    if (this.isInfluencer(requester)) {
      if (!filters.influencerId) {
        throw new BadRequestException(
          'Los usuarios influencer deben indicar su identificador para consultar ajustes'
        );
      }
    }

    return this.database.listWithdrawalAdjustments(filters);
  }

  resolveAdjustment(id: string, dto: ResolveAdjustmentDto, user: AuthenticatedUserPayload) {
    if (!this.canManagePayments(user)) {
      throw new ForbiddenException('No tiene permisos para resolver ajustes');
    }

    const resolved = this.database.resolveWithdrawalAdjustment(id, {
      resolvedBy: user.email ?? user.sub,
      resolutionType: dto.resolutionType,
      notes: dto.notes
    });

    if (!resolved) {
      throw new BadRequestException('Ajuste no encontrado');
    }

    this.notifications.emit({
      type: `adjustment.${dto.resolutionType}`,
      recipient: `influencer:${resolved.influencerId}`,
      payload: {
        adjustmentId: resolved.id,
        resolutionType: dto.resolutionType,
        resolvedAt: resolved.resolvedAt?.toISOString()
      }
    });

    return resolved;
  }

  attachDocumentToWithdrawal(
    id: string,
    dto: AddDocumentDto,
    user: AuthenticatedUserPayload
  ) {
    const document = this.database.addWithdrawalDocument(id, dto, user.email ?? user.sub);
    if (!document) {
      throw new BadRequestException('Solicitud de retiro no encontrada');
    }
    return document;
  }

  attachDocumentToPayment(id: string, dto: AddDocumentDto, user: AuthenticatedUserPayload) {
    if (!this.canManagePayments(user)) {
      throw new ForbiddenException('No tiene permisos para adjuntar documentos a pagos');
    }

    const document = this.database.addPaymentDocument(id, dto, user.email ?? user.sub);
    if (!document) {
      throw new BadRequestException('Pago no encontrado');
    }
    return document;
  }

  private parseStatusFilter(raw?: string): WithdrawalStatus[] {
    if (!raw) {
      return [];
    }

    const values = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean) as WithdrawalStatus[];

    return values.filter((value) => ALLOWED_WITHDRAWAL_STATUSES.includes(value));
  }

  private parseAdjustmentStatusFilter(raw?: string): WithdrawalAdjustmentStatus[] {
    if (!raw) {
      return [];
    }

    const values = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean) as WithdrawalAdjustmentStatus[];

    return values.filter((value) => ALLOWED_ADJUSTMENT_STATUSES.includes(value));
  }

  private mapDocuments(documents?: WithdrawalDocumentDto[]): RequestWithdrawalArgs['documents'] {
    if (!documents) {
      return undefined;
    }

    return documents.map((doc) => ({
      type: doc.type,
      filename: doc.filename,
      url: doc.url,
      notes: doc.notes
    }));
  }

  private canManagePayments(user: AuthenticatedUserPayload): boolean {
    return user.roles.includes(AppRole.FINANCE) || user.roles.includes(AppRole.ADMIN_DENTSU);
  }

  private isInfluencer(user: AuthenticatedUserPayload): boolean {
    return user.roles.includes(AppRole.INFLUENCER);
  }

  private normalizeError(error: unknown): BadRequestException {
    if (error instanceof BadRequestException) {
      return error;
    }

    if (error instanceof Error) {
      return new BadRequestException(error.message);
    }

    return new BadRequestException('Operación inválida');
  }
}
