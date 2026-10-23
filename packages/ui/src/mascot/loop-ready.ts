/**
 * Exactly one walking Credi at a time: `container` holds a still poster (`data-part="poster"`) and
 * the animated loop (`data-part="loop"`); CSS shows the poster until `data-loop-ready` is set,
 * then the loop alone. Stacking both drew two overlapping Credis ("4 arms and 4 legs").
 * Resolves once decided (for tests); never rejects.
 */
export function revealLoopWhenReady(container: HTMLElement): Promise<void> {
  const loop = container.querySelector<HTMLImageElement>('img[data-part="loop"]');
  if (!loop) return Promise.resolve();
  return loop.decode().then(
    () => {
      container.dataset.loopReady = '';
    },
    () => {
      // The loop could not load or decode: the poster stays, a still Credi beats none. Decorative
      // art, nothing to report.
    },
  );
}
