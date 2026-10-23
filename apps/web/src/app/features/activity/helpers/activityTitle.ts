import type { Activity } from '@acme/contracts';
import { itemCountLabel } from '@/app/helpers/cart';
import { t } from '@/app/i18n';
import { ACTIVITY_TYPE_LABEL } from '../data';

/**
 * One ledger line's title in the page language: the movement type, plus the merchant and the units
 * for purchases, from the row's structured fields. The API's `description` is English prose kept
 * for older clients and is never shown.
 */
export function activityTitle(item: Pick<Activity, 'type' | 'merchantName' | 'itemCount'>): string {
  const type = t(ACTIVITY_TYPE_LABEL[item.type]);
  if (item.type !== 'purchase' || !item.merchantName) return type;
  if (item.itemCount === 0) return `${type} · ${item.merchantName}`;
  return `${type} · ${t('activity.orders.summary', { merchant: item.merchantName, items: itemCountLabel(item.itemCount) })}`;
}
