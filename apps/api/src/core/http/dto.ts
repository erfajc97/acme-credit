import { idSchema, pageQuerySchema } from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** `:id` route parameter: a UUID. */
export class IdParamDto extends createZodDto(z.object({ id: idSchema }).strict()) {}

/** Numbered pagination query shared by every list (`?page=&pageSize=`, at most 10 rows). */
export class PageQueryDto extends createZodDto(pageQuerySchema) {}

/** Body of the actions that carry none (freeze, unfreeze, close, reversal): `{}` or nothing. */
export class EmptyBodyDto extends createZodDto(
  // Express leaves `body` undefined when nothing was sent.
  z.preprocess((body) => body ?? {}, z.object({}).strict()),
) {}
