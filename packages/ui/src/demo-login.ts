export interface DemoLogin {
  email: string;
  password: string;
}

interface DemoLoginConfig extends DemoLogin {
  /** PUBLIC_DEMO_MODE: false (the default) in every production build. */
  enabled: boolean;
}

/**
 * The login the "Use demo account" button fills, or null when there is none to offer. The values
 * come only from public build-time env (never a literal in code): demo mode must be on AND both
 * values set, so a production build with the defaults ships no credential at all.
 */
export function demoLogin({ enabled, email, password }: DemoLoginConfig): DemoLogin | null {
  if (!enabled || !email.trim() || !password.trim()) return null;
  return { email, password };
}
