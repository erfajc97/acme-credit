import { z } from 'zod';
import { emailField, fullNameField, newPasswordField } from '@/app/helpers/authFields';

export const signUpSchema = z.object({
  fullName: fullNameField,
  email: emailField,
  password: newPasswordField,
});

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignUpValues = z.output<typeof signUpSchema>;
