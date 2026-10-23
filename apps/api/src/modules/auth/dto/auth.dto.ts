import { loginRequestSchema, registerRequestSchema } from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerRequestSchema) {}

export class LoginDto extends createZodDto(loginRequestSchema) {}
