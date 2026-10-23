import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Ports, URLs and the seeded admin come from the repo's .env (G20), never from literals. Node's
// own loader (no dotenv dependency); a variable already set in the shell wins over the file.
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** A variable the suite cannot run without: fails loudly with the variable's name, never its value. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `e2e: ${name} is not set (root .env or the shell). Run \`pnpm docker:up\` once to create .env.`,
    );
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
