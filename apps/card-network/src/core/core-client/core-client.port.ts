import type {
  Authorization,
  ErrorCode,
  networkAuthorizationRequestSchema,
  networkCaptureRequestSchema,
  ProviderWebhook,
} from '@acme/contracts';
import type { z } from 'zod';

export type NetworkAuthorizationRequest = z.infer<typeof networkAuthorizationRequestSchema>;
export type NetworkCaptureRequest = z.infer<typeof networkCaptureRequestSchema>;

/**
 * What a call to the core ended in. `unavailable` = timeout, network error or 5xx after every
 * retry: the outcome is UNKNOWN, never "no" (A9, MO4). `rejected` = a final 4xx.
 */
export type CoreCallResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'rejected'; status: number; code: ErrorCode | null }
  | { kind: 'unavailable' };

export interface CoreCallOptions {
  /** Sent on every attempt of the call, unchanged, so the core applies it once (P3). */
  idempotencyKey: string;
  /** Attempts after the first one. */
  retries: number;
  /** Aborts waits and in-flight attempts (app shutdown). */
  signal?: AbortSignal;
}

/** Port to the lending core (apps/api). Only the HTTP adapter talks to it (A9). */
export interface CoreClient {
  authorize(
    body: NetworkAuthorizationRequest,
    options: CoreCallOptions,
  ): Promise<CoreCallResult<Authorization>>;
  capture(
    authorizationId: string,
    body: NetworkCaptureRequest,
    options: CoreCallOptions,
  ): Promise<CoreCallResult<null>>;
  reverse(authorizationId: string, options: CoreCallOptions): Promise<CoreCallResult<null>>;
  /** The payment provider's webhook (`POST /v1/webhooks/payments`). */
  notifyPayment(body: ProviderWebhook, options: CoreCallOptions): Promise<CoreCallResult<null>>;
}

export const CORE_CLIENT = Symbol('CORE_CLIENT');
