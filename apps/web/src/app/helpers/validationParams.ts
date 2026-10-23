import {
  EMAIL_MAX,
  MAX_DEPOSIT_CENTS,
  MIN_DEPOSIT_CENTS,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '@acme/contracts';
import { formatAmount } from './money';

/**
 * Values the validation copy interpolates (G12: a cap shared by API and UI is one constant that
 * the copy interpolates, never a number typed into a sentence). A function: the amounts are
 * formatted in the page locale at the moment they are shown.
 */
export function validationParams() {
  return {
    emailMax: EMAIL_MAX,
    passwordMin: PASSWORD_MIN,
    passwordMax: PASSWORD_MAX,
    nameMax: NAME_MAX,
    depositMin: formatAmount(MIN_DEPOSIT_CENTS),
    depositMax: formatAmount(MAX_DEPOSIT_CENTS),
  };
}
