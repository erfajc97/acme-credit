import { z } from 'zod';
import { currentPasswordField, emailField } from '@/app/helpers/authFields';

export const signInSchema = z.object({ email: emailField, password: currentPasswordField });

export type SignInInput = z.input<typeof signInSchema>;
export type SignInValues = z.output<typeof signInSchema>;
