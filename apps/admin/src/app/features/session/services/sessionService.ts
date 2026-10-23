import { z } from 'zod';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';

/** POST /auth/logout: 204, the API clears the refresh cookie. */
export function signOut(): Promise<undefined> {
  return apiRequest({ path: ENDPOINTS.auth.logout, method: 'POST', schema: z.undefined() });
}
