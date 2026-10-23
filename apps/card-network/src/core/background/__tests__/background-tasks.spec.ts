import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundTasks } from '../background-tasks';

describe('BackgroundTasks', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs a task after its delay, not before', async () => {
    const tasks = new BackgroundTasks();
    const task = vi.fn(() => Promise.resolve());
    tasks.schedule('capture:a', 4_000, task);
    await vi.advanceTimersByTimeAsync(3_999);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending task (a void before the capture) and reports whether it was pending', async () => {
    const tasks = new BackgroundTasks();
    const task = vi.fn(() => Promise.resolve());
    tasks.schedule('capture:a', 1_000, task);
    expect(tasks.cancel('capture:a')).toBe(true);
    expect(tasks.cancel('capture:a')).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(task).not.toHaveBeenCalled();
  });

  it('cannot cancel a task that already started', async () => {
    const tasks = new BackgroundTasks();
    tasks.schedule('capture:a', 0, () => new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(0);
    expect(tasks.cancel('capture:a')).toBe(false);
  });

  it('logs a failed task instead of leaving a floating rejection (G18)', async () => {
    const tasks = new BackgroundTasks();
    const logged = vi.spyOn(tasks['logger'], 'error').mockImplementation(() => undefined);
    tasks.schedule('webhook:p', 0, () => Promise.reject(new Error('boom')));
    await vi.advanceTimersByTimeAsync(0);
    expect(logged).toHaveBeenCalledWith('background task webhook:p failed: Error: boom');
  });

  it('on shutdown clears pending timers, aborts running tasks and waits for them', async () => {
    const tasks = new BackgroundTasks();
    const pending = vi.fn(() => Promise.resolve());
    let seenSignal: AbortSignal | undefined;
    let finished = false;
    tasks.schedule('running', 0, (signal) => {
      seenSignal = signal;
      return new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => {
          finished = true;
          resolve();
        }),
      );
    });
    tasks.schedule('pending', 10_000, pending);
    await vi.advanceTimersByTimeAsync(0);

    await tasks.onApplicationShutdown();

    expect(seenSignal?.aborted).toBe(true);
    expect(finished).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    tasks.schedule('late', 0, pending);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(pending).not.toHaveBeenCalled();
  });
});
