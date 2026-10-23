import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '../health';

describe('healthResponseSchema', () => {
  it('accepts the liveness body and rejects anything else', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok', service: 'lending-core' }).success).toBe(
      true,
    );
    expect(healthResponseSchema.safeParse({ status: 'down', service: 'x' }).success).toBe(false);
    expect(
      healthResponseSchema.safeParse({ status: 'ok', service: 'x', version: '1' }).success,
    ).toBe(false);
  });
});
