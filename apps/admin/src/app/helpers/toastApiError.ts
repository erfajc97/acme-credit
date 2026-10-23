import type { TranslateParams } from '@acme/ui';
import { t } from '@/app/i18n';
import { getApiErrorCode } from '@/app/lib/apiClient';
import { sonnerResponse } from './sonnerResponse';
import { translateError } from './translateError';

/**
 * Error toast of every mutation's onError (W5, W6): the copy of the API code, or the action's
 * fallback key when the failure carries no code (offline, timeout). Never the backend message.
 * `params` fills the amounts some codes name (docs/brand.md: errors name the amount).
 */
export function toastApiError(error: unknown, fallbackKey: string, params?: TranslateParams): void {
  const code = getApiErrorCode(error);
  sonnerResponse(t(code ? translateError(code) : fallbackKey, params), 'error');
}
