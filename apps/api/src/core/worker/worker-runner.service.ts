import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { OUTBOX_HANDLERS, OutboxRelay, type OutboxHandler } from '../outbox/outbox-relay';
import { PollingLoop } from './polling-loop';

/** A job the worker runs on a fixed interval (e.g. the pending-payments sweep). */
export interface PeriodicJob {
  name: string;
  intervalMs: number;
  run(): Promise<unknown>;
}

export const PERIODIC_JOBS = Symbol('PERIODIC_JOBS');

export const OUTBOX_POLL_MS = 1_000;

/**
 * The worker process (P2): one loop drains the outbox, one loop per periodic job. Loops start
 * after bootstrap and stop, waiting for the running tick, on shutdown (SIGTERM).
 */
@Injectable()
export class WorkerRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerRunner.name);
  private readonly loops: PollingLoop[];

  constructor(
    relay: OutboxRelay,
    @Inject(OUTBOX_HANDLERS) handlers: OutboxHandler[],
    @Inject(PERIODIC_JOBS) jobs: PeriodicJob[],
  ) {
    this.loops = [
      new PollingLoop({
        name: 'outbox',
        intervalMs: OUTBOX_POLL_MS,
        tick: () => relay.processBatch(handlers),
        logger: this.logger,
      }),
      ...jobs.map(
        (job) =>
          new PollingLoop({
            name: job.name,
            intervalMs: job.intervalMs,
            tick: () => job.run(),
            logger: this.logger,
          }),
      ),
    ];
  }

  onApplicationBootstrap(): void {
    for (const loop of this.loops) loop.start();
  }

  async onApplicationShutdown(): Promise<void> {
    for (const loop of this.loops) await loop.stop();
  }
}
