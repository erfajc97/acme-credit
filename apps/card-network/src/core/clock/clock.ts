/** Injectable time source, so tests pin instants (FT7) and signatures use one clock. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };
