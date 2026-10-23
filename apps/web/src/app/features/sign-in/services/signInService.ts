import { sessionSchema, type Session } from '@acme/contracts';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';
import type { SignInValues } from '../schema';

/** POST /auth/login for the customer app; the API also sets the httpOnly refresh cookie. */
export function signIn(values: SignInValues): Promise<Session> {
  return apiRequest({
    path: ENDPOINTS.auth.login,
    method: 'POST',
    body: { email: values.email, password: values.password, audience: 'customer' },
    schema: sessionSchema,
  });
}
