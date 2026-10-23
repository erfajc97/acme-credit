import { MAX_OPERATION_CENTS, parseMoneyInput } from '@acme/contracts';
import { z } from 'zod';

/**
 * An amount typed as text (W11): required, parsed by the ONE shared parser (P1) into integer
 * cents, and never auto-corrected — "12.345", "-5" or "1e3" are flagged, not rounded.
 */
export const amountTextField = z
  .string()
  .trim()
  .min(1, 'validation.amountRequired')
  .transform((text, context) => {
    const cents = parseMoneyInput(text);
    if (cents === null) {
      context.addIssue({ code: 'custom', message: 'validation.amountInvalid' });
      return z.NEVER;
    }
    return cents;
  })
  .refine((cents) => cents <= MAX_OPERATION_CENTS, 'validation.amountTooLarge');
