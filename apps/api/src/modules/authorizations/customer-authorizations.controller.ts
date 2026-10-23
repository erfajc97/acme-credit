import type { Authorization, AuthorizationDetail } from '@acme/contracts';
import { CurrentPrincipal, Roles, type Principal } from '@acme/nest-core';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { IdParamDto, PageQueryDto } from '../../core/http/dto';
import type { Page } from '../../core/http/pagination';
import { AuthorizationsService } from './authorizations.service';
import { AuthorizationParamDto } from './dto/customer.dto';

@Controller('v1/accounts/:id/authorizations')
@Roles('customer')
export class CustomerAuthorizationsController {
  constructor(private readonly authorizations: AuthorizationsService) {}

  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @Param() params: IdParamDto,
    @Query() query: PageQueryDto,
  ): Promise<Page<Authorization>> {
    return this.authorizations.listForCustomer(principal.id, params.id, query);
  }

  /** Order detail: merchant, priced lines, totals and the status timeline. */
  @Get(':authorizationId')
  detail(
    @CurrentPrincipal() principal: Principal,
    @Param() params: AuthorizationParamDto,
  ): Promise<AuthorizationDetail> {
    return this.authorizations.getForCustomer(principal.id, params.id, params.authorizationId);
  }
}
