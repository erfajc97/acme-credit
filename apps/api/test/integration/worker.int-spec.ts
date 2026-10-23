import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/core/database/prisma.service';
import { OutboxRelay } from '../../src/core/outbox/outbox-relay';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../src/core/payment-provider/payment-provider.port';
import { PendingPaymentsSweeper } from '../../src/modules/payments/jobs/pending-payments.sweeper';
import { PaymentSettlementService } from '../../src/modules/payments/payment-settlement.service';
import { PayoutRequestedHandler } from '../../src/modules/payouts/jobs/payout-requested.handler';
import { PayoutsService } from '../../src/modules/payouts/payouts.service';
import { WorkerModule } from '../../src/worker.module';
import {
  activeAccount,
  createUser,
  deposit,
  key,
  openAccount,
  startHarness,
  type Harness,
} from './support/harness';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.close();
});

/** The worker's collaborators, wired to the API app's providers (same database, same provider). */
function worker() {
  const prisma = h.app.get(PrismaService);
  const settlement = h.app.get(PaymentSettlementService);
  const provider = h.app.get<PaymentProvider>(PAYMENT_PROVIDER);
  return {
    relay: new OutboxRelay(prisma),
    payouts: new PayoutRequestedHandler(h.app.get(PayoutsService)),
    sweeper: new PendingPaymentsSweeper(prisma, settlement, provider),
  };
}

describe('outbox worker (P2)', () => {
  it('boots and shuts down its own process context', async () => {
    const context = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    await context.close();
  });

  it('sends a requested payout through the provider and marks it SENT, once', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    await h.http.post(`/v1/accounts/${account.id}/close`).set(user.auth).set(key());
    const payout = await h.db.payout.findFirstOrThrow({ where: { accountId: account.id } });
    const { relay, payouts } = worker();

    // Drain everything pending; only payout.requested has a handler.
    while ((await relay.processBatch([payouts], 50)) > 0);

    const sent = await h.db.payout.findUniqueOrThrow({ where: { id: payout.id } });
    // The provider knows the payout by its attempt reference, not by our id (MO5).
    expect(sent).toMatchObject({
      status: 'SENT',
      providerPaymentId: h.provider.byReference(payout.providerReference).id,
    });
    expect(h.provider.byReference(payout.providerReference)).toMatchObject({
      purpose: 'payout',
      amountCents: '20000',
    });
    // Handled again (a crash before "done"): the provider dedupes and the payout stays SENT.
    await payouts.handle({
      id: 'replay',
      type: 'payout.requested',
      payload: { entityId: payout.id },
      attempts: 2,
    });
    expect(await h.db.payout.count({ where: { accountId: account.id, status: 'SENT' } })).toBe(1);
    expect(
      await h.db.auditLog.count({ where: { entityId: payout.id, action: 'payout.sent' } }),
    ).toBe(1);
  });

  it('sweeps a payment approved without a webhook through the same settlement path (MO4)', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const created = await deposit(h, user, account.id, '20000');
    h.provider.setStatus(created.id, 'SUCCEEDED');
    const { sweeper } = worker();

    // Not stale yet: left for the webhook.
    await sweeper.sweepOnce(new Date());
    expect(
      (await h.db.collateralDeposit.findUniqueOrThrow({ where: { id: created.id } })).status,
    ).toBe('PENDING');

    h.provider.down = true;
    try {
      await sweeper.sweepOnce(new Date(Date.now() + 61_000));
    } finally {
      h.provider.down = false;
    }
    expect(
      (await h.db.collateralDeposit.findUniqueOrThrow({ where: { id: created.id } })).status,
    ).toBe('PENDING');

    await sweeper.sweepOnce(new Date(Date.now() + 61_000));
    expect(
      (await h.db.collateralDeposit.findUniqueOrThrow({ where: { id: created.id } })).status,
    ).toBe('CONFIRMED');
    const mine = await h.http.get('/v1/accounts/me').set(user.auth);
    expect(mine.body).toMatchObject({ status: 'ACTIVE', creditLimitCents: '20000' });
  });

  it('marks a payment the provider failed as FAILED, without crediting anything', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const created = await deposit(h, user, account.id, '20000');
    h.provider.setStatus(created.id, 'FAILED');
    await worker().sweeper.sweepOnce(new Date(Date.now() + 61_000));
    expect(
      (await h.db.collateralDeposit.findUniqueOrThrow({ where: { id: created.id } })).status,
    ).toBe('FAILED');
    const mine = await h.http.get('/v1/accounts/me').set(user.auth);
    expect(mine.body).toMatchObject({ status: 'PENDING_COLLATERAL', collateralCents: '0' });
  });
});
