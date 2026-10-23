import type { Authorization } from '@acme/contracts';
import { Signed, SKIP_ALL_THROTTLES } from '@acme/nest-core';
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Actor } from '../../core/audit/record-change';
import { EmptyBodyDto, IdParamDto } from '../../core/http/dto';
import { CurrentActor, IdempotentRequest } from '../../core/http/request-context';
import type { IdempotentRequest as IdempotentRequestInput } from '../../core/idempotency/idempotency.service';
import { AuthorizationsService } from './authorizations.service';
import { NetworkAuthorizationDto, NetworkCaptureDto } from './dto/network.dto';

/**
 * The card network's door (P3): HMAC-signed and idempotent. Signed service traffic is not
 * rate limited per IP: the network itself throttles purchases, and a 429 here would turn a
 * burst of real purchases into declines.
 */
@Controller('v1/network/authorizations')
@Signed('network')
@SkipThrottle(SKIP_ALL_THROTTLES)
export class NetworkController {
  constructor(private readonly authorizations: AuthorizationsService) {}

  /** 201 for approvals AND declines: a decline is a decision, not an error. */
  @Post()
  @HttpCode(201)
  authorize(
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Body() body: NetworkAuthorizationDto,
  ): Promise<Authorization> {
    return this.authorizations.authorize(actor, request, body);
  }

  @Post(':id/capture')
  @HttpCode(201)
  capture(
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() body: NetworkCaptureDto,
  ): Promise<Authorization> {
    return this.authorizations.capture(actor, request, {
      authorizationId: params.id,
      amountCents: body.amountCents,
    });
  }

  @Post(':id/reversal')
  @HttpCode(201)
  reversal(
    @CurrentActor() actor: Actor,
    @IdempotentRequest() request: IdempotentRequestInput,
    @Param() params: IdParamDto,
    @Body() _body: EmptyBodyDto,
  ): Promise<Authorization> {
    return this.authorizations.reverse(actor, request, params.id);
  }
}
