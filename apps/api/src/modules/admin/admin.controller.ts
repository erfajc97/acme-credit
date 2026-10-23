import type {
  AdminAccount,
  AdminAccountAction,
  AdminAccountDetail,
  AdminAuthorization,
  AdminCloseAccountResponse,
  AdminPayout,
  AuditLogEntry,
  Authorization,
  Dashboard,
  JournalEntry,
} from '@acme/contracts';
import { Roles } from '@acme/nest-core';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { Actor } from '../../core/audit/record-change';
import { EmptyBodyDto, IdParamDto } from '../../core/http/dto';
import type { Page } from '../../core/http/pagination';
import { CurrentActor, IdempotentRequest } from '../../core/http/request-context';
import type { IdempotentRequest as IdempotentRequestInput } from '../../core/idempotency/idempotency.service';
import { AccountLifecycleService } from '../accounts/account-lifecycle.service';
import { AuthorizationsService } from '../authorizations/authorizations.service';
import { AdminService } from './admin.service';
import {
  AdminAccountAuthorizationsQueryDto,
  AdminAccountsQueryDto,
  AdminAuthorizationsQueryDto,
  AdminFreezeDto,
  AdminLedgerQueryDto,
  AdminPayoutsQueryDto,
  AuditLogQueryDto,
} from './dto/admin.dto';
import { toAdminAccountAction, toAdminCloseResponse } from './helpers/admin-account-view';

/** Back office (R-50, R-51). Admin actions are idempotent and audited with the admin's id. */
@Controller('v1/admin')
@Roles('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly lifecycle: AccountLifecycleService,
    private readonly holds: AuthorizationsService,
  ) {}

  @Get('dashboard')
  dashboard(): Promise<Dashboard> {
    return this.admin.dashboard();
  }

  @Get('accounts')
  accounts(@Query() query: AdminAccountsQueryDto): Promise<Page<AdminAccount>> {
    return this.admin.listAccounts(query);
  }

  @Get('accounts/:id')
  account(@Param() params: IdParamDto): Promise<AdminAccountDetail> {
    return this.admin.getAccount(params.id);
  }

  @Get('accounts/:id/ledger')
  accountLedger(
    @Param() params: IdParamDto,
    @Query() query: AdminLedgerQueryDto,
  ): Promise<Page<JournalEntry>> {
    return this.admin.ledger({ ...query, accountId: params.id });
  }

  @Get('accounts/:id/authorizations')
  accountAuthorizations(
    @Param() params: IdParamDto,
    @Query() query: AdminAccountAuthorizationsQueryDto,
  ): Promise<Page<Authorization>> {
    return this.admin.accountAuthorizations(params.id, query);
  }

  @Get('authorizations')
  authorizations(@Query() query: AdminAuthorizationsQueryDto): Promise<Page<AdminAuthorization>> {
    return this.admin.listAuthorizations(query);
  }

  @Get('ledger')
  ledger(@Query() query: AdminLedgerQueryDto): Promise<Page<JournalEntry>> {
    return this.admin.ledger(query);
  }

  @Get('audit-log')
  auditLog(@Query() query: AuditLogQueryDto): Promise<Page<AuditLogEntry>> {
    return this.admin.auditLog(query);
  }

  @Post('accounts/:id/freeze')
  @HttpCode(200)
  freeze(
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() body: AdminFreezeDto,
  ): Promise<AdminAccountAction> {
    return this.lifecycle
      .freeze(actor, request, { accountId: params.id }, body.reason)
      .then(toAdminAccountAction);
  }

  @Post('accounts/:id/unfreeze')
  @HttpCode(200)
  unfreeze(
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() _body: EmptyBodyDto,
  ): Promise<AdminAccountAction> {
    return this.lifecycle
      .unfreeze(actor, request, { accountId: params.id })
      .then(toAdminAccountAction);
  }

  @Post('accounts/:id/close')
  @HttpCode(200)
  close(
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() _body: EmptyBodyDto,
  ): Promise<AdminCloseAccountResponse> {
    return this.lifecycle
      .close(actor, request, { accountId: params.id })
      .then(toAdminCloseResponse);
  }

  /** Payouts across accounts: pending, retried, sent or failed for good (operations view). */
  @Get('payouts')
  payouts(@Query() query: AdminPayoutsQueryDto): Promise<Page<AdminPayout>> {
    return this.admin.listPayouts(query);
  }

  /** Releases a live hold the merchant will never capture; a later capture is refused. */
  @Post('authorizations/:id/release')
  @HttpCode(200)
  release(
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() _body: EmptyBodyDto,
  ): Promise<Authorization> {
    return this.holds.release(actor, request, params.id);
  }
}
