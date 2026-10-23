import { createHash } from 'node:crypto';
import { SPLASH_GATE_SCRIPT } from './splash/splash-gate';
import { THEME_INIT_SCRIPT } from './theme-init';

const sha256 = (source: string): `sha256-${string}` =>
  `sha256-${createHash('sha256').update(source).digest('base64')}`;

/**
 * CSP hash of the inline theme script, for the apps' `security.csp.scriptDirective.hashes`.
 * Node-only (astro.config); kept out of the browser index on purpose.
 */
export function themeScriptHash(): `sha256-${string}` {
  return sha256(THEME_INIT_SCRIPT);
}

/** CSP hash of the inline splash gate (SplashGate.astro); add it next to the theme's. */
export function splashGateScriptHash(): `sha256-${string}` {
  return sha256(SPLASH_GATE_SCRIPT);
}
