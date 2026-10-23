import { optionalEnv } from './env';

// Base URLs come from the ports in the repo's .env (G20), never hard-coded. Every app is addressed
// through the same host so the API's refresh cookie is sent from both web apps.
const HOST = optionalEnv('E2E_HOST') ?? 'localhost';

function base(variable: string, fallbackPort: number): string {
  return `http://${HOST}:${optionalEnv(variable) ?? String(fallbackPort)}`;
}

export const WEB_URL = base('WEB_PORT', 4321);
export const ADMIN_URL = base('ADMIN_PORT', 4322);
export const API_URL = base('API_PORT', 3000);
export const NETWORK_URL = base('NETWORK_PORT', 3001);
