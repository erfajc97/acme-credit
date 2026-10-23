import { idSchema } from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** `/v1/accounts/:id/authorizations/:authorizationId`: both UUIDs. */
export class AuthorizationParamDto extends createZodDto(
  z.object({ id: idSchema, authorizationId: idSchema }).strict(),
) {}
