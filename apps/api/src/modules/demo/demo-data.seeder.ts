import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Actor } from '../../core/audit/record-change';
import { PrismaService } from '../../core/database/prisma.service';
import type { InstantPaymentProvider } from '../../core/payment-provider/instant-payment-provider';
import { PAYMENT_PROVIDER } from '../../core/payment-provider/payment-provider.port';
import { AccountsService } from '../accounts/accounts.service';
import { AuthorizationsService } from '../authorizations/authorizations.service';
import { PaymentRequestsService } from '../payments/payment-requests.service';
import { PaymentSettlementService } from '../payments/payment-settlement.service';
import {
  DEMO_DEPOSIT_CENTS,
  DEMO_PURCHASES,
  DEMO_REPAYMENT_CENTS,
  demoKey,
  type DemoPurchase,
} from './helpers/demo-plan';

const NETWORK: Actor = { type: 'network', id: null, requestId: null };
const PROVIDER: Actor = { type: 'provider', id: null, requestId: null };

/**
 * Gives the demo customer a realistic history (dev and demo only: the seed calls it only when
 * the env creates the demo customer). Every step runs through the real services, so the ledger,
 * the cached balances and the audit trail agree exactly as they would for a real customer.
 * Idempotent: each step carries a deterministic key, so a re-run replays instead of repeating.
 */
@Injectable()
export class DemoDataSeeder {
  private readonly logger = new Logger(DemoDataSeeder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly payments: PaymentRequestsService,
    private readonly settlement: PaymentSettlementService,
    private readonly authorizations: AuthorizationsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: InstantPaymentProvider,
  ) {}

  async seed(customerId: string): Promise<void> {
    if (await this.hasOwnHistory(customerId)) {
      this.logger.log('the demo customer already has an account of its own: left as is');
      return;
    }
    const customer = { type: 'customer' as const, id: customerId, requestId: null };
    const request = (step: string, path: string) => ({
      key: demoKey(customerId, step),
      method: 'POST',
      path,
    });
    const account = await this.accounts.open(customer, request('open', '/v1/accounts'));
    const deposit = await this.payments.requestDeposit({
      actor: customer,
      request: request('deposit', `/v1/accounts/${account.id}/deposits`),
      accountId: account.id,
      amountCents: DEMO_DEPOSIT_CENTS,
    });
    await this.approve(deposit.id);
    const card = await this.prisma.account.findUniqueOrThrow({
      where: { id: account.id },
      select: { cardToken: true },
    });
    if (!card.cardToken) throw new Error('the demo account has no card after its deposit');
    for (const purchase of DEMO_PURCHASES) {
      await this.purchase({ customerId, cardToken: card.cardToken, purchase });
    }
    const repayment = await this.payments.requestRepayment({
      actor: customer,
      request: request('repayment', `/v1/accounts/${account.id}/repayments`),
      accountId: account.id,
      amountCents: DEMO_REPAYMENT_CENTS,
    });
    await this.approve(repayment.id);
    this.logger.log({ accountId: account.id }, 'demo customer history ready');
  }

  /** An account the seed did not open (no record of its first step): never seeded over. */
  private async hasOwnHistory(customerId: string): Promise<boolean> {
    const [account, seeded] = await Promise.all([
      this.prisma.account.findFirst({ where: { customerId }, select: { id: true } }),
      this.prisma.idempotencyKey.findUnique({
        where: { scope_key: { scope: customerId, key: demoKey(customerId, 'open') } },
        select: { id: true },
      }),
    ]);
    return account !== null && seeded === null;
  }

  /** The customer approves at the bank and the provider's webhook settles it (real path). */
  private async approve(reference: string): Promise<void> {
    const target = await this.settlement.findByReference(reference);
    if (!target || target.settled) return;
    const paymentId = this.provider.approve(reference);
    await this.settlement.handleWebhook(PROVIDER, { paymentId, reference });
  }

  private async purchase(input: {
    customerId: string;
    cardToken: string;
    purchase: DemoPurchase;
  }): Promise<void> {
    const { customerId, purchase } = input;
    const authorization = await this.authorizations.authorize(
      NETWORK,
      {
        key: demoKey(customerId, `purchase:${purchase.step}`),
        method: 'POST',
        path: '/v1/network/authorizations',
      },
      {
        cardToken: input.cardToken,
        amountCents: purchase.amountCents,
        merchant: purchase.merchant,
        ...(purchase.items ? { items: purchase.items } : {}),
      },
    );
    if (!purchase.capture || authorization.status === 'DECLINED') return;
    await this.authorizations.capture(
      NETWORK,
      {
        key: demoKey(customerId, `capture:${purchase.step}`),
        method: 'POST',
        path: `/v1/network/authorizations/${authorization.id}/capture`,
      },
      { authorizationId: authorization.id, amountCents: purchase.amountCents },
    );
  }
}
