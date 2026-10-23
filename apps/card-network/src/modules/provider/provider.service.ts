import { randomUUID } from 'node:crypto';
import type { ProviderCreatePayment, ProviderPayment } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BackgroundTasks } from '../../core/background/background-tasks';
import { CLOCK, type Clock } from '../../core/clock/clock';
import type { Env } from '../../core/config/env';
import { ENV } from '../../core/config/env.provider';
import { CORE_CLIENT, type CoreClient } from '../../core/core-client/core-client.port';
import { deterministicUuid } from '../../core/ids/deterministic-uuid';

/** Attempts after the first one, with backoff, until the core answers 2xx or a final 4xx. */
export const WEBHOOK_RETRIES = 5;

export type Settlement = 'SUCCEEDED' | 'FAILED';

/**
 * "Acme Bank", the simulated payment provider (ADR-0001). Payments live in memory: a restart
 * forgets them, and the core then sees `common.not_found` when it re-reads one (MO4).
 */
@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);
  private readonly payments = new Map<string, ProviderPayment>();
  private readonly idByReference = new Map<string, string>();

  constructor(
    @Inject(CORE_CLIENT) private readonly core: CoreClient,
    private readonly tasks: BackgroundTasks,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ENV) private readonly env: Pick<Env, 'PUBLIC_URL'>,
  ) {}

  /** Idempotent by the core's reference: a retried create returns the same payment. */
  create(input: ProviderCreatePayment): ProviderPayment {
    const existingId = this.idByReference.get(input.reference);
    if (existingId !== undefined) return this.replay(existingId, input);

    const id = randomUUID();
    this.payments.set(id, {
      id,
      reference: input.reference,
      amountCents: input.amountCents,
      purpose: input.purpose,
      status: 'PENDING',
      approveUrl: new URL(`/provider/pay/${id}`, this.env.PUBLIC_URL).toString(),
      createdAt: this.clock.now().toISOString(),
      settledAt: null,
    });
    this.idByReference.set(input.reference, id);
    // A payout sends money TO the customer: nobody has to approve it on the bank page.
    return input.purpose === 'payout' ? this.settle(id, 'SUCCEEDED') : this.get(id);
  }

  get(id: string): ProviderPayment {
    const payment = this.find(id);
    if (!payment) throw new AppHttpException('common.not_found');
    return payment;
  }

  find(id: string): ProviderPayment | undefined {
    const payment = this.payments.get(id);
    return payment && { ...payment };
  }

  /** Only a PENDING payment settles; approving or declining again is a no-op (idempotent). */
  settle(id: string, outcome: Settlement): ProviderPayment {
    const payment = this.get(id);
    if (payment.status !== 'PENDING') return payment;
    const settled = { ...payment, status: outcome, settledAt: this.clock.now().toISOString() };
    this.payments.set(id, settled);
    this.sendWebhook(settled);
    return { ...settled };
  }

  private replay(id: string, input: ProviderCreatePayment): ProviderPayment {
    const existing = this.get(id);
    if (existing.amountCents !== input.amountCents || existing.purpose !== input.purpose) {
      throw new AppHttpException('idempotency.key_reused', { reference: input.reference });
    }
    return existing;
  }

  /** Only ids travel: the core re-reads the payment here before crediting anything (MO4). */
  private sendWebhook(payment: ProviderPayment): void {
    this.tasks.schedule(`webhook:${payment.id}`, 0, async (signal) => {
      const result = await this.core.notifyPayment(
        { paymentId: payment.id, reference: payment.reference },
        {
          idempotencyKey: deterministicUuid(`webhook:${payment.id}`),
          retries: WEBHOOK_RETRIES,
          signal,
        },
      );
      if (result.kind !== 'ok') {
        this.logger.error(`webhook for payment ${payment.id} not delivered: ${result.kind}`);
      }
    });
  }
}
