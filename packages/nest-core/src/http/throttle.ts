import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Principal } from '../auth/access.decorators';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * Three windows for every route (A12, EDoS/DDoS). `burst` stops a flood within a second,
 * `default` is a browsing budget no person reaches (a page load is a handful of calls), and
 * `hourly` caps a slow, sustained abuse that a per-minute limit lets through. Instances are
 * fixed-size (no autoscaling), so abuse costs latency, never money; these limits keep it short.
 */
export const DEFAULT_THROTTLE: ThrottlerModuleOptions = [
  { name: 'burst', ttl: SECOND, limit: 50 },
  { name: 'default', ttl: MINUTE, limit: 300 },
  { name: 'hourly', ttl: HOUR, limit: 6_000 },
];

/**
 * For signed server-to-server routes only (card network → core, provider webhooks): the HMAC
 * already rejects strangers before any work, and the network legitimately bursts (a store rush).
 * `@SkipThrottle()` alone would skip only the `default` window.
 */
export const SKIP_ALL_THROTTLES = { burst: true, default: true, hourly: true };

/** Sign-in: slows password guessing; a reviewer signs in a few times an hour. */
export const CREDENTIALS_THROTTLE = {
  default: { ttl: MINUTE, limit: 10 },
  hourly: { ttl: HOUR, limit: 120 },
};

/** Sign-up and account opening create rows that stay: the tightest door (EDoS). */
export const SIGNUP_THROTTLE = {
  default: { ttl: MINUTE, limit: 5 },
  hourly: { ttl: HOUR, limit: 60 },
};

/** Session refresh and sign-out: called once per page load at most. */
export const SESSION_THROTTLE = { default: { ttl: MINUTE, limit: 30 } };

/** Every call that creates a payment at the provider or moves money, per customer. */
export const MONEY_THROTTLE = {
  default: { ttl: MINUTE, limit: 10 },
  hourly: { ttl: HOUR, limit: 60 },
};

interface TrackedRequest {
  ip?: string;
  principal?: Principal;
}

/**
 * Counts a signed-in caller by who they are and an anonymous one by IP. Reviewers behind one
 * office or VPN address each keep their own budget, and nobody escapes a limit by rotating IPs
 * once signed in. Runs after the access guard (AN10), which sets `principal`.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const { principal, ip } = request as TrackedRequest;
    return Promise.resolve(
      principal ? `${principal.role}:${principal.id}` : `ip:${ip ?? 'unknown'}`,
    );
  }
}
