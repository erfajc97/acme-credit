import { revealLoopWhenReady } from '../mascot/loop-ready';

/**
 * The bug: the still poster sat under the animated walk, so two Credis overlapped ("4 arms and 4
 * legs"). Exactly one shows: the poster until the loop can paint, then the loop alone.
 */
describe('revealLoopWhenReady', () => {
  function walker(decode: () => Promise<void>) {
    const container = document.createElement('div');
    container.innerHTML = '<img data-part="poster"><img data-part="loop">';
    const loop = container.querySelector('img[data-part="loop"]') as HTMLImageElement;
    loop.decode = decode;
    return container;
  }

  it('swaps to the loop once it is decoded, not before', async () => {
    let decoded: () => void = () => undefined;
    const container = walker(() => new Promise<void>((resolve) => (decoded = resolve)));
    const ready = revealLoopWhenReady(container);
    expect(container.dataset.loopReady).toBeUndefined();
    decoded();
    await ready;
    expect(container.dataset.loopReady).toBe('');
  });

  it('keeps the poster when the loop cannot load (a still Credi beats none)', async () => {
    const container = walker(() => Promise.reject(new Error('EncodingError')));
    await revealLoopWhenReady(container);
    expect(container.dataset.loopReady).toBeUndefined();
  });

  it('does nothing without a loop', async () => {
    const container = document.createElement('div');
    await revealLoopWhenReady(container);
    expect(container.dataset.loopReady).toBeUndefined();
  });
});
