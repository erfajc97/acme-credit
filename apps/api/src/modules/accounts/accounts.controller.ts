import type { Account, Activity } from '@acme/contracts';
import { CurrentPrincipal, Roles, SIGNUP_THROTTLE, type Principal } from '@acme/nest-core';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Actor } from '../../core/audit/record-change';
import { EmptyBodyDto, IdParamDto, PageQueryDto } from '../../core/http/dto';
import type { Page } from '../../core/http/pagination';
import { CurrentActor, IdempotentRequest } from '../../core/http/request-context';
import type { IdempotentRequest as IdempotentRequestInput } from '../../core/idempotency/idempotency.service';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AccountsService } from './accounts.service';
import type { CloseAccountResponse } from './dto/account-responses';

/** The customer's own account (R-01, R-05, R-52). Ownership is enforced in every query. */
@Controller('v1/accounts')
@Roles('customer')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly lifecycle: AccountLifecycleService,
  ) {}

  @Post()
  @Throttle(SIGNUP_THROTTLE)
  @HttpCode(201)
  open(
    @CurrentPrincipal() principal: Principal,
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Body() _body: EmptyBodyDto,
  ): Promise<Account> {
    return this.accounts.open({ ...actor, id: principal.id }, request);
  }

  @Get('me')
  mine(@CurrentPrincipal() principal: Principal): Promise<Account> {
    return this.accounts.getMine(principal.id);
  }

  @Get(':id/activity')
  activity(
    @CurrentPrincipal() principal: Principal,
    @Param() params: IdParamDto,
    @Query() query: PageQueryDto,
  ): Promise<Page<Activity>> {
    return this.accounts.listActivity(principal.id, params.id, query);
  }

  @Post(':id/freeze')
  @HttpCode(200)
  freeze(
    @CurrentPrincipal() principal: Principal,
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() _body: EmptyBodyDto,
  ): Promise<Account> {
    return this.lifecycle.freeze(actor, request, { accountId: params.id, ownerId: principal.id });
  }

  @Post(':id/unfreeze')
  @HttpCode(200)
  unfreeze(
    @CurrentPrincipal() principal: Principal,
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() _body: EmptyBodyDto,
  ): Promise<Account> {
    return this.lifecycle.unfreeze(actor, request, { accountId: params.id, ownerId: principal.id });
  }

  @Post(':id/close')
  @HttpCode(200)
  close(
    @CurrentPrincipal() principal: Principal,
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() _body: EmptyBodyDto,
  ): Promise<CloseAccountResponse> {
    return this.lifecycle.close(actor, request, { accountId: params.id, ownerId: principal.id });
  }
}
