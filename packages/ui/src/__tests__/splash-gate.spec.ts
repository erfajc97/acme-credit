import { splashGateScriptHash } from '../theme-hash';
import { SPLASH_GATE_SCRIPT, SPLASH_STORAGE_KEY } from '../splash/splash-gate';

/** The gate decides before the first paint whether the brand splash plays (once per session). */
describe('SPLASH_GATE_SCRIPT', () => {
  let reduced = false;

  beforeEach(() => {
    reduced = false;
    delete document.documentElement.dataset.splash;
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  });

  afterEach(() => vi.unstubAllGlobals());

  const run = () => new Function(SPLASH_GATE_SCRIPT)();

  it('plays the full intro on the first load of the session and remembers it', () => {
    run();
    expect(document.documentElement.dataset.splash).toBe('full');
    expect(sessionStorage.getItem(SPLASH_STORAGE_KEY)).toBe('1');
  });

  it('never plays again in the same session (a reload or a second page)', () => {
    sessionStorage.setItem(SPLASH_STORAGE_KEY, '1');
    run();
    expect(document.documentElement.dataset.splash).toBeUndefined();
  });

  it('plays the static fade under prefers-reduced-motion', () => {
    reduced = true;
    run();
    expect(document.documentElement.dataset.splash).toBe('reduced');
  });

  it('replays on demand with ?intro=1 even after it played', () => {
    sessionStorage.setItem(SPLASH_STORAGE_KEY, '1');
    window.history.replaceState(null, '', '/?intro=1');
    run();
    expect(document.documentElement.dataset.splash).toBe('full');
  });

  it('stays off when storage is blocked (a reload cannot be told from a first view)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    run();
    expect(document.documentElement.dataset.splash).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('exposes a CSP hash of exactly the inlined source', () => {
    expect(splashGateScriptHash()).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
  });
});
