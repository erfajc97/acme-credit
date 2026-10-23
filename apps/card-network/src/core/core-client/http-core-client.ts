import {
  authorizationSchema,
  isErrorCode,
  type Authorization,
  type ErrorCode,
} from '@acme/contracts';
import { signRequest } from '@acme/nest-core';
import type { Clock } from '../clock/clock';
import { retryWithBackoff, type Sleep } from '../retry/retry';
import type {
  CoreCallOptions,
  CoreCallResult,
  CoreClient,
  NetworkAuthorizationRequest,
  NetworkCaptureRequest,
} from './core-client.port';

export interface HttpCoreClientConfig {
  baseUrl: string;
  /** Signs the card network's calls (authorize, capture, reversal). */
  networkSecret: string;
  /** Signs the payment provider's webhooks. */
  providerSecret: string;
  clock: Clock;
  sleep: Sleep;
  fetch: typeof fetch;
  /** Per attempt (A9). */
  timeoutMs: number;
  backoff: { baseDelayMs: number; maxDelayMs: number };
  logger: { warn(message: string): void; error(message: string): void };
}

type Attempt = CoreCallResult<unknown>;

/**
 * The only code that talks HTTP to the lending core (A9). Every attempt is signed fresh
 * (P3: `timestamp.METHOD.path.idempotencyKey.rawBody`), carries the caller's Idempotency-Key
 * unchanged (signed, so a replay cannot swap it) and has its own timeout; timeouts, network
 * errors, 5xx, 429 and "same key still in progress" are retried with backoff, any other 4xx
 * is final. Logs carry the path and status only: bodies hold card tokens (A15).
 */
export class HttpCoreClient implements CoreClient {
  constructor(private readonly config: HttpCoreClientConfig) {}

  async authorize(
    body: NetworkAuthorizationRequest,
    options: CoreCallOptions,
  ): Promise<CoreCallResult<Authorization>> {
    const result = await this.post({
      path: '/v1/network/authorizations',
      body,
      secret: this.config.networkSecret,
      options,
    });
    if (result.kind !== 'ok') return result;
    const parsed = authorizationSchema.safeParse(result.value);
    if (!parsed.success) {
      this.config.logger.error('core answered an authorization outside the contract');
      return { kind: 'unavailable' };
    }
    return { kind: 'ok', value: parsed.data };
  }

  capture(authorizationId: string, body: NetworkCaptureRequest, options: CoreCallOptions) {
    return this.postIgnoringBody({
      path: `/v1/network/authorizations/${encodeURIComponent(authorizationId)}/capture`,
      body,
      secret: this.config.networkSecret,
      options,
    });
  }

  reverse(authorizationId: string, options: CoreCallOptions) {
    return this.postIgnoringBody({
      path: `/v1/network/authorizations/${encodeURIComponent(authorizationId)}/reversal`,
      body: {},
      secret: this.config.networkSecret,
      options,
    });
  }

  notifyPayment(body: { paymentId: string; reference: string }, options: CoreCallOptions) {
    return this.postIgnoringBody({
      path: '/v1/webhooks/payments',
      body,
      secret: this.config.providerSecret,
      options,
    });
  }

  /** Capture, reversal and webhooks only need to know the core accepted the call. */
  private async postIgnoringBody(input: PostInput): Promise<CoreCallResult<null>> {
    const result = await this.post(input);
    return result.kind === 'ok' ? { kind: 'ok', value: null } : result;
  }

  private post(input: PostInput): Promise<Attempt> {
    const url = new URL(input.path, this.config.baseUrl);
    const rawBody = JSON.stringify(input.body);
    return retryWithBackoff({
      run: () => this.send({ url, rawBody, secret: input.secret, options: input.options }),
      shouldRetry: (attempt) => attempt.kind === 'unavailable',
      policy: { retries: input.options.retries, ...this.config.backoff },
      sleep: this.config.sleep,
      signal: input.options.signal,
    });
  }

  private async send(input: {
    url: URL;
    rawBody: string;
    secret: string;
    options: CoreCallOptions;
  }): Promise<Attempt> {
    const { url, rawBody, secret, options } = input;
    const nowSeconds = Math.floor(this.config.clock.now().getTime() / 1000);
    const headers = {
      'Content-Type': 'application/json',
      'Idempotency-Key': options.idempotencyKey,
      ...signRequest(
        {
          secret,
          method: 'POST',
          path: url.pathname,
          idempotencyKey: options.idempotencyKey,
          rawBody,
        },
        nowSeconds,
      ),
    };
    const timeout = AbortSignal.timeout(this.config.timeoutMs);
    const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;

    let status: number;
    let payload: unknown;
    try {
      const response = await this.config.fetch(url, {
        method: 'POST',
        headers,
        body: rawBody,
        signal,
      });
      status = response.status;
      payload = parseJson(await response.text());
    } catch (error) {
      // Timeout or network error: the outcome is unknown, so the same key is retried.
      this.config.logger.warn(`core ${url.pathname} unreachable: ${errorName(error)}`);
      return { kind: 'unavailable' };
    }

    if (status >= 200 && status < 300) return { kind: 'ok', value: payload };
    const code = codeOf(payload);
    if (status >= 500 || status === 429 || code === 'idempotency.in_progress') {
      this.config.logger.warn(`core ${url.pathname} answered ${status}`);
      return { kind: 'unavailable' };
    }
    return { kind: 'rejected', status, code };
  }
}

interface PostInput {
  path: string;
  body: unknown;
  secret: string;
  options: CoreCallOptions;
}

/** An empty or non-JSON body is treated as absent; the status still decides. */
function parseJson(text: string): unknown {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null; // a proxy's HTML error page: only the status matters
  }
}

function codeOf(payload: unknown): ErrorCode | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const code = (payload as { code?: unknown }).code;
  return isErrorCode(code) ? code : null;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
