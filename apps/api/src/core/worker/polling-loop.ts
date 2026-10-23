import type { LoggerService } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';

export interface PollingLoopOptions {
  name: string;
  intervalMs: number;
  tick: () => Promise<unknown>;
  logger: Pick<LoggerService, 'error'>;
  sleep?: (ms: number, signal: AbortSignal) => Promise<unknown>;
}

/**
 * Runs `tick` every `intervalMs` until stopped (A10: a poll always has a stop condition). A tick
 * never overlaps the previous one; a failing tick is logged and the loop goes on.
 */
export class PollingLoop {
  private readonly stopSignal = new AbortController();
  private running: Promise<void> | undefined;

  constructor(private readonly options: PollingLoopOptions) {}

  start(): void {
    this.running ??= this.run();
  }

  async stop(): Promise<void> {
    this.stopSignal.abort();
    await this.running;
  }

  private async run(): Promise<void> {
    const sleep = this.options.sleep ?? ((ms, signal) => delay(ms, undefined, { signal }));
    while (!this.stopSignal.signal.aborted) {
      try {
        await this.options.tick();
      } catch (error) {
        this.options.logger.error({ loop: this.options.name, err: error }, 'worker tick failed');
      }
      try {
        await sleep(this.options.intervalMs, this.stopSignal.signal);
      } catch {
        // The sleep was aborted by stop(): the while condition ends the loop.
      }
    }
  }
}
