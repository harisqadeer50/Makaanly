import { z } from 'zod';
import { PROPERTY_TYPES, REPORT_REASONS, INQUIRY_STATUSES, APPOINTMENT_STATUSES, VIEWING } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const text = (min, max, msg) => z.string().trim().min(min, msg).max(max);
const blank = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const phone = z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number');
const optPhone = z.preprocess(blank, phone.optional());
const page = z.coerce.number().int().min(1).max(10000).default(1);
const flag = z.preprocess((v) => (['true', '1', true].includes(v) ? true : ['false', '0', false].includes(v) ? false : undefined), z.boolean().optional());
const isoDate = (msg) => z.string().datetime({ offset: true, message: msg }).transform((s) => new Date(s));

export const propertyIdParam = z.object({ propertyId: objectId });
export const idParam = z.object({ id: objectId });

// ---- inquiries ----
export const createInquiryBody = z.object({
  propertyId: objectId,
  message: text(10, 2000, 'Write at least 10 characters'),
  phone: optPhone,
  preferredVisitAt: z.preprocess(blank, isoDate('Choose a valid date and time').refine((d) => d.getTime() > Date.now(), 'Choose a time in the future')
    .refine((d) => d.getTime() < Date.now() + 180 * 86400000, 'Choose a date within the next 6 months').optional()),
});
export const inquiryListQuery = z.object({ page, limit: z.coerce.number().int().min(1).max(50).default(15), status: z.preprocess(blank, z.enum(INQUIRY_STATUSES).optional()) });
export const inquiryStatusBody = z.object({ status: z.enum(['read', 'replied', 'closed']) });
export const replyBody = z.object({ message: text(1, 2000, 'Write a message') });

// ---- appointments ----
export const createAppointmentBody = z.object({
  propertyId: objectId,
  start: isoDate('Choose a valid date and time'),
  durationMinutes: z.coerce.number().refine((n) => VIEWING.slotMinutes.includes(n), `Choose ${VIEWING.slotMinutes.join(' or ')} minutes`).default(30),
  message: z.preprocess(blank, text(1, 500).optional()),
  phone: optPhone,
});
export const appointmentActionBody = z.object({
  action: z.enum(['confirm', 'decline', 'reschedule', 'accept', 'complete']),
  reason: z.preprocess(blank, text(1, 300).optional()),
  start: z.preprocess(blank, isoDate('Choose a valid date and time').optional()),
  durationMinutes: z.coerce.number().refine((n) => VIEWING.slotMinutes.includes(n)).optional(),
}).refine((d) => d.action !== 'reschedule' || d.start, { path: ['start'], message: 'Choose the new date and time' });
export const cancelBody = z.object({ reason: z.preprocess(blank, text(1, 300).optional()) });
export const appointmentListQuery = z.object({
  page, limit: z.coerce.number().int().min(1).max(50).default(15),
  status: z.preprocess(blank, z.enum(APPOINTMENT_STATUSES).optional()), upcoming: flag,
});

// ---- reports ----
export const reportBody = z.object({ reason: z.enum(REPORT_REASONS), description: z.preprocess(blank, text(1, 1000).optional()) })
  .refine((d) => d.reason !== 'other' || (d.description && d.description.length >= 10), { path: ['description'], message: 'Please describe the problem (at least 10 characters)' });

// ---- agents and profile ----
export const agentProfileBody = z.object({
  agencyName: text(0, 80).nullish(),
  bio: text(20, 1500, 'Tell clients about yourself in at least 20 characters'),
  serviceAreas: z.array(text(2, 60)).max(10).default([]).transform((a) => [...new Set(a)]),
  specialties: z.array(z.enum(PROPERTY_TYPES)).max(6).default([]).transform((a) => [...new Set(a)]),
  contactPhone: z.preprocess(blank, phone.nullish()),
  contactEmail: z.preprocess(blank, z.string().trim().toLowerCase().email('Enter a valid email address').nullish()),
});
export const agentsQuery = z.object({
  page, limit: z.coerce.number().int().min(1).max(24).default(12),
  q: z.preprocess(blank, text(2, 60).optional()), city: z.preprocess(blank, text(1, 60).optional()),
});
export const userUpdateBody = z.object({ name: text(2, 80, 'Enter your full name').optional(), phone: z.preprocess((v) => (v === '' ? null : v), phone.nullish()) })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' });

export const preferencesBody = z.object({ emailNotifications: z.boolean() });
