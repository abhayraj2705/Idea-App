import { z } from 'zod/mini';

// Mirrors the backend's zod rules for registration / password. Uses zod/mini
// (tree-shakable Zod v4) to keep the JS bundle inside the §8.6 budget.
export const emailSchema = z.string().check(z.trim(), z.minLength(1, 'Email is required'), z.email('Enter a valid email'));
export const passwordSchema = z
  .string()
  .check(
    z.minLength(8, 'At least 8 characters'),
    z.maxLength(128, 'At most 128 characters'),
    z.regex(/[A-Za-z]/, 'Include a letter'),
    z.regex(/[0-9]/, 'Include a number'),
  );
export const nameSchema = z.string().check(z.trim(), z.minLength(1, 'Name is required'), z.maxLength(80, 'At most 80 characters'));

export const signInSchema = z.object({ email: emailSchema, password: z.string().check(z.minLength(1, 'Password is required')) });
export const signUpSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .check(z.refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ['confirm'] }));
export const codeSchema = z.object({ code: z.string().check(z.regex(/^\d{6}$/, 'Enter the 6-digit code')) });
export const changePasswordSchema = z
  .object({ currentPassword: z.string().check(z.minLength(1, 'Required')), newPassword: passwordSchema, confirm: z.string() })
  .check(z.refine((v) => v.newPassword === v.confirm, { message: "Passwords don't match", path: ['confirm'] }));
export const inviteSchema = z.object({ email: emailSchema });
export const profileSchema = z.object({ name: nameSchema });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
