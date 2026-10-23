/**
 * A controllable window.matchMedia for jsdom (it has none): `set()` flips which queries match and
 * notifies the listeners, the way a real browser does when the window is resized or a mouse is
 * plugged in.
 */
export function installMatchMedia(initial: readonly string[] = []) {
  let matching = new Set(initial);
  const listeners = new Map<string, Set<() => void>>();
  window.matchMedia = (query: string) =>
    ({
      media: query,
      get matches() {
        return matching.has(query);
      },
      addEventListener: (_type: string, listener: () => void) => {
        const set = listeners.get(query) ?? new Set();
        set.add(listener);
        listeners.set(query, set);
      },
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.get(query)?.delete(listener),
    }) as unknown as MediaQueryList;
  return {
    set(next: readonly string[]) {
      matching = new Set(next);
      for (const set of listeners.values()) for (const listener of set) listener();
    },
    listenerCount: () => [...listeners.values()].reduce((count, set) => count + set.size, 0),
  };
}
