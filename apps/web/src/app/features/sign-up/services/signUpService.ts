import { sessionSchema, type Session } from '@acme/contracts';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';
import type { SignUpValues } from '../schema';

/** POST /auth/register: creates the customer and signs them in (refresh cookie set by the API). */
export function signUp(values: SignUpValues): Promise<Session> {
  return apiRequest({
    path: ENDPOINTS.auth.register,
    method: 'POST',
    body: { email: values.email, password: values.password, fullName: values.fullName },
    schema: sessionSchema,
  });
}
