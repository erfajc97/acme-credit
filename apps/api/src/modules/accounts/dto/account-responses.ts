import type { closeAccountResponseSchema } from '@acme/contracts';
import type { z } from 'zod';

export type CloseAccountResponse = z.infer<typeof closeAccountResponseSchema>;
