import type { Deposit, Repayment } from '@acme/contracts';
import { CurrentPrincipal, MONEY_THROTTLE, Roles, type Principal } from '@acme/nest-core';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Actor } from '../../core/audit/record-change';
import { IdParamDto, PageQueryDto } from '../../core/http/dto';
import type { Page } from '../../core/http/pagination';
import { CurrentActor, IdempotentRequest } from '../../core/http/request-context';
import type { IdempotentRequest as IdempotentRequestInput } from '../../core/idempotency/idempotency.service';
import { AmountRequestDto } from './dto/payment.dto';
import { PaymentRequestsService } from './payment-requests.service';

/** Collateral deposits (R-01, R-55) and repayments (R-04) of the customer's own account. */
@Controller('v1/accounts/:id')
@Roles('customer')
export class PaymentsController {
  constructor(private readonly payments: PaymentRequestsService) {}

  @Post('deposits')
  @HttpCode(201)
  @Throttle(MONEY_THROTTLE)
  deposit(
    @CurrentPrincipal() principal: Principal,
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() body: AmountRequestDto,
  ): Promise<Deposit> {
    return this.payments.requestDeposit({
      actor: { ...actor, id: principal.id },
      request,
      accountId: params.id,
      amountCents: body.amountCents,
    });
  }

  @Get('deposits')
  deposits(
    @CurrentPrincipal() principal: Principal,
    @Param() params: IdParamDto,
    @Query() query: PageQueryDto,
  ): Promise<Page<Deposit>> {
    return this.payments.listDeposits(principal.id, params.id, query);
  }

  @Post('repayments')
  @Throttle(MONEY_THROTTLE)
  @HttpCode(201)
  repay(
    @CurrentPrincipal() principal: Principal,
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() body: AmountRequestDto,
  ): Promise<Repayment> {
    return this.payments.requestRepayment({
      actor: { ...actor, id: principal.id },
      request,
      accountId: params.id,
      amountCents: body.amountCents,
    });
  }

  @Get('repayments')
  repayments(
    @CurrentPrincipal() principal: Principal,
    @Param() params: IdParamDto,
    @Query() query: PageQueryDto,
  ): Promise<Page<Repayment>> {
    return this.payments.listRepayments(principal.id, params.id, query);
  }
}
