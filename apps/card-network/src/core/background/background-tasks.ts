import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';

export type BackgroundTask = (signal: AbortSignal) => Promise<void>;

/**
 * The simulator's in-memory scheduler (delayed captures, webhook deliveries). State lives in
 * the process: a restart forgets pending work — acceptable for a simulator, and harmless to
 * money because the core holds the authorizations and every call is idempotent. On shutdown
 * pending timers are cleared and running tasks are aborted and awaited, so nothing outlives
 * the app (A10).
 */
@Injectable()
export class BackgroundTasks implements OnApplicationShutdown {
  private readonly logger = new Logger(BackgroundTasks.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly running = new Set<Promise<void>>();
  private readonly shutdown = new AbortController();

  /** Runs `task` after `delayMs`. Scheduling an existing key replaces the pending one. */
  schedule(key: string, delayMs: number, task: BackgroundTask): void {
    if (this.shutdown.signal.aborted) return;
    this.cancel(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      this.start(key, task);
    }, delayMs);
    this.timers.set(key, timer);
  }

  /** True when the task was still pending and will now never run. */
  cancel(key: string): boolean {
    const timer = this.timers.get(key);
    if (!timer) return false;
    clearTimeout(timer);
    this.timers.delete(key);
    return true;
  }

  async onApplicationShutdown(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.shutdown.abort();
    await Promise.allSettled([...this.running]);
  }

  private start(key: string, task: BackgroundTask): void {
    const run: Promise<void> = task(this.shutdown.signal)
      .catch((error: unknown) => {
        this.logger.error(`background task ${key} failed: ${String(error)}`);
      })
      .finally(() => this.running.delete(run));
    this.running.add(run);
  }
}
