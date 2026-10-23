import type { PaymentKind } from '@/app/tanstack-queries/paymentsQuery';

/** The i18n keys of a transfer's states, per kind (deposit or payment). Keys, not copy (W1). */
export const TRANSFER_COPY: Record<
  PaymentKind,
  {
    waitingTitle: string;
    waitingBody: string;
    confirmedTitle: string;
    confirmedBody: string;
    failedTitle: string;
    failedBody: string;
  }
> = {
  deposit: {
    waitingTitle: 'transfer.deposit.waitingTitle',
    waitingBody: 'transfer.deposit.waitingBody',
    confirmedTitle: 'transfer.deposit.confirmedTitle',
    confirmedBody: 'transfer.deposit.confirmedBody',
    failedTitle: 'transfer.deposit.failedTitle',
    failedBody: 'transfer.deposit.failedBody',
  },
  repayment: {
    waitingTitle: 'transfer.repayment.waitingTitle',
    waitingBody: 'transfer.repayment.waitingBody',
    confirmedTitle: 'transfer.repayment.confirmedTitle',
    confirmedBody: 'transfer.repayment.confirmedBody',
    failedTitle: 'transfer.repayment.failedTitle',
    failedBody: 'transfer.repayment.failedBody',
  },
};
