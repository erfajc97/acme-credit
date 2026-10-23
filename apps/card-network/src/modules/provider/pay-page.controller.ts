import { MONEY_THROTTLE, Public } from '@acme/nest-core';
import {
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Redirect,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Env } from '../../core/config/env';
import { ENV } from '../../core/config/env.provider';
import { PayPageQueryDto, PaymentIdParamsDto } from './dto/provider.dto';
import {
  isPayPageLocale,
  PAY_PAGE_CSP,
  PAY_PAGE_CSS,
  renderNotFoundPage,
  renderPayPage,
  resolvePayPageLocale,
} from './helpers/pay-page';
import { ProviderService, type Settlement } from './provider.service';

/** Approving or declining is a state change from a public page: stricter limit (A12). */

/** The slice of Express' response the HTML pages need. */
interface HtmlResponse {
  status(code: number): HtmlResponse;
  setHeader(name: string, value: string): unknown;
  send(body: string): unknown;
}

/**
 * The bank's hosted page the customer is redirected to. `@Public()` like a real hosted
 * payment page: the unguessable payment id in the link is the capability, and the core only
 * credits what it re-reads from the provider API (MO4).
 */
@Controller('provider')
@Public()
export class PayPageController {
  constructor(
    private readonly provider: ProviderService,
    @Inject(ENV) private readonly env: Pick<Env, 'WEB_URL'>,
  ) {}

  @Get('pay/:id')
  page(
    @Param() params: PaymentIdParamsDto,
    @Query() query: PayPageQueryDto,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: HtmlResponse,
  ): void {
    const locale = resolvePayPageLocale({ lang: query.lang, acceptLanguage });
    const payment = this.provider.find(params.id);
    const html = payment
      ? renderPayPage({ payment, webUrl: this.env.WEB_URL, locale })
      : renderNotFoundPage({ webUrl: this.env.WEB_URL, locale });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Accept-Language');
    res.setHeader('Content-Security-Policy', PAY_PAGE_CSP);
    res.status(payment ? 200 : 404).send(html);
  }

  @Get('assets/pay.css')
  @Header('Content-Type', 'text/css; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  stylesheet(): string {
    return PAY_PAGE_CSS;
  }

  @Post('pay/:id/approve')
  @Throttle(MONEY_THROTTLE)
  @Redirect()
  approve(@Param() params: PaymentIdParamsDto, @Query() query: PayPageQueryDto) {
    return this.settle({ id: params.id, outcome: 'SUCCEEDED', lang: query.lang });
  }

  @Post('pay/:id/decline')
  @Throttle(MONEY_THROTTLE)
  @Redirect()
  decline(@Param() params: PaymentIdParamsDto, @Query() query: PayPageQueryDto) {
    return this.settle({ id: params.id, outcome: 'FAILED', lang: query.lang });
  }

  /**
   * Post/redirect/get: the browser lands back on the page, which shows the result, in the
   * language the form was shown in (only a supported one is echoed into the URL).
   */
  private settle(input: { id: string; outcome: Settlement; lang: string | undefined }) {
    this.provider.settle(input.id, input.outcome);
    const page = `/provider/pay/${encodeURIComponent(input.id)}`;
    const url = isPayPageLocale(input.lang) ? `${page}?lang=${input.lang}` : page;
    return { url, statusCode: 303 };
  }
}
