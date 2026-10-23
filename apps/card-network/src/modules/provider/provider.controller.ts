import type { ProviderPayment } from '@acme/contracts';
import { Signed } from '@acme/nest-core';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CreatePaymentDto, PaymentIdParamsDto } from './dto/provider.dto';
import { ProviderService } from './provider.service';

/** The provider's server-to-server API: only the core calls it, signed (P3). */
@Controller('v1/provider/payments')
@Signed('core')
export class ProviderController {
  constructor(private readonly provider: ProviderService) {}

  @Post()
  @HttpCode(201)
  create(@Body() body: CreatePaymentDto): ProviderPayment {
    return this.provider.create(body);
  }

  /** What the core re-reads before crediting anything (MO4). */
  @Get(':id')
  get(@Param() params: PaymentIdParamsDto): ProviderPayment {
    return this.provider.get(params.id);
  }
}
