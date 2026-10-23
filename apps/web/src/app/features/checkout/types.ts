import type { TranslateParams } from '@acme/ui';
import type { OrderLineView } from '@/app/helpers/orders';

/** What the customer reads after the network answered (rendered in the page, not a toast). */
export type CheckoutOutcome =
  | {
      kind: 'approved';
      titleKey: string;
      params: TranslateParams;
      total: string;
      lines: OrderLineView[];
    }
  | {
      kind: 'declined';
      titleKey: string;
      bodyKey: string;
      params: TranslateParams;
      next: { labelKey: string; route: string };
    };

export type { OrderLineView };
