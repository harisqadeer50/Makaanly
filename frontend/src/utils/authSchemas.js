import { z } from 'zod';

// Mirrors backend/src/validators/auth.validator.js. The server remains the source of truth.
export const email = z.string().trim().toLowerCase().email('Enter a valid email address');
export const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number');

const matches = (d, ctx) => {
  if (d.password !== d.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
};

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email, password, confirmPassword: z.string().min(1, 'Confirm your password'),
  phone: z.string().trim().regex(/^(\+?[0-9\s-]{7,15})?$/, 'Enter a valid phone number').optional(),
  role: z.enum(['buyer', 'owner', 'agent'], { error: 'Choose a valid account type' }),
  acceptTerms: z.literal(true, { error: 'You must accept the terms and privacy policy' }),
}).superRefine(matches);
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ password, confirmPassword: z.string().min(1, 'Confirm your password') }).superRefine(matches);

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), password, confirmPassword: z.string().min(1, 'Confirm your new password') })
  .superRefine(matches)
  .superRefine((d, ctx) => { if (d.password && d.password === d.currentPassword) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Choose a password that is different from your current one' }); });
