import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext } from '@playwright/test';
import { signInAdmin } from './api';
import { API_URL } from './urls';

/**
 * The operator token the suite's setup and teardown use, cached between runs: sign-in is
 * throttled (10 per minute), so the API is asked once and the token reused while it still works.
 * Git-ignored (e2e/.gitignore) and short-lived (the API's access-token TTL).
 */
const SESSION_FILE = fileURLToPath(new URL('../.auth/admin-token.json', import.meta.url));

async function isValid(api: APIRequestContext, token: string): Promise<boolean> {
  const response = await api.get(`${API_URL}/v1/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok()) return false;
  const me = (await response.json()) as { role?: string };
  return me.role === 'admin';
}

function readCached(): string | null {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(SESSION_FILE, 'utf8')) as { token?: unknown };
    return typeof parsed.token === 'string' ? parsed.token : null;
  } catch {
    // A file another worker is rewriting reads as broken JSON: sign in again instead.
    return null;
  }
}

/** A working operator token: the cached one when the API still accepts it, else a new sign-in. */
export async function adminToken(api: APIRequestContext): Promise<string> {
  const cached = readCached();
  if (cached && (await isValid(api, cached))) return cached;
  const token = await signInAdmin(api);
  mkdirSync(dirname(SESSION_FILE), { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify({ token }));
  return token;
}
