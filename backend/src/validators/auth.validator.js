import { z } from 'zod';
import { REGISTERABLE_ROLES } from '../config/constants.js';

export const emailField = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

// bcrypt only uses the first 72 bytes, so cap there.
export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number');

const phoneField = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number').optional(),
);

const matchPasswords = (data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  }
};

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email: emailField,
  password: passwordField,
  confirmPassword: z.string(),
  phone: phoneField,
  role: z.enum(REGISTERABLE_ROLES, { errorMap: () => ({ message: 'Choose a valid account type' }) }).default('buyer'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms and privacy policy' }) }),
}).superRefine(matchPasswords);

export const loginSchema = z.object({ email: emailField, password: z.string().min(1, 'Enter your password').max(200) });
export const forgotPasswordSchema = z.object({ email: emailField });
export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordField,
  confirmPassword: z.string(),
}).superRefine(matchPasswords);

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  password: passwordField,
  confirmPassword: z.string(),
}).superRefine(matchPasswords);
