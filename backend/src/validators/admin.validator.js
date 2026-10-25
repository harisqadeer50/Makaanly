import { z } from 'zod';
import { ROLES, PROPERTY_STATUSES, AUDIT_ACTIONS, VERIFICATION_STATUSES, REPORT_STATUSES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const blank = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const page = z.coerce.number().int().min(1).max(10000).default(1);
const limit = (max = 50, def = 20) => z.coerce.number().int().min(1).max(max).default(def);
const flag = z.preprocess((v) => (['true', '1', true].includes(v) ? true : ['false', '0', false].includes(v) ? false : undefined), z.boolean().optional());
const reason = (min = 5) => z.string().trim().min(min, `Give a short reason (at least ${min} characters)`).max(500);
const csv = (item) => z.preprocess((v) => (v === undefined || v === '' ? undefined : (Array.isArray(v) ? v : [v]).flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean)), z.array(item).max(10).optional());

export const idParam = z.object({ id: objectId });
export const documentParams = z.object({ id: objectId, docId: objectId });

export const usersQuery = z.object({
  page, limit: limit(),
  q: z.preprocess(blank, z.string().trim().min(2).max(80).optional()),
  role: csv(z.enum(ROLES)),
  status: z.preprocess(blank, z.enum(['active', 'suspended']).optional()),
});
export const userStatusBody = z.object({ isActive: z.boolean(), reason: z.preprocess(blank, reason().optional()) })
  .refine((d) => d.isActive || d.reason, { path: ['reason'], message: 'Give a reason for the suspension (at least 5 characters)' });

export const adminPropertiesQuery = z.object({
  page, limit: limit(),
  q: z.preprocess(blank, z.string().trim().min(2).max(80).optional()),
  status: z.preprocess(blank, z.enum(PROPERTY_STATUSES).optional()),
  city: z.preprocess(blank, z.string().trim().min(1).max(60).optional()),
  owner: z.preprocess(blank, objectId.optional()),
  featured: flag,
});
export const moderationBody = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.preprocess(blank, reason().optional()),
  note: z.preprocess(blank, z.string().trim().max(1000).optional()), // internal, never shown to the owner
}).refine((d) => d.decision === 'approve' || d.reason, { path: ['reason'], message: 'A reason is required when rejecting a listing (at least 5 characters)' });
export const featuredBody = z.object({ isFeatured: z.boolean() });

export const reportsQuery = z.object({ page, limit: limit(), status: z.preprocess(blank, z.enum(REPORT_STATUSES).optional()), property: z.preprocess(blank, objectId.optional()) });
export const reportUpdateBody = z.object({
  status: z.enum(['under_review', 'resolved', 'dismissed']),
  resolution: z.preprocess(blank, z.string().trim().min(3, 'Add a short note (at least 3 characters)').max(1000).optional()),
  propertyAction: z.preprocess(blank, z.enum(['pause', 'reject']).optional()),
}).refine((d) => d.status === 'under_review' || d.resolution, { path: ['resolution'], message: 'Add a short note explaining the outcome' })
  .refine((d) => !d.propertyAction || d.status === 'resolved', { path: ['propertyAction'], message: 'A listing can only be paused or rejected when resolving a report' });

export const verificationsQuery = z.object({ page, limit: limit(), status: z.preprocess(blank, z.enum(VERIFICATION_STATUSES).optional()) });
export const verificationDecisionBody = z.object({ decision: z.enum(['approve', 'reject', 'revoke']), reason: z.preprocess(blank, reason().optional()) })
  .refine((d) => d.decision === 'approve' || d.reason, { path: ['reason'], message: 'A reason is required (at least 5 characters)' });
export const verificationSubmitBody = z.object({ message: z.preprocess(blank, z.string().trim().max(1000).optional()) });

export const auditQuery = z.object({
  page, limit: limit(100, 25),
  action: z.preprocess(blank, z.enum(AUDIT_ACTIONS).optional()),
  targetType: z.preprocess(blank, z.enum(['property', 'user', 'report', 'verification', 'category']).optional()),
  actor: z.preprocess(blank, objectId.optional()),
  from: z.preprocess(blank, z.coerce.date().optional()), to: z.preprocess(blank, z.coerce.date().optional()),
}).refine((d) => !d.from || !d.to || d.from <= d.to, { path: ['from'], message: 'The start date must not be after the end date' });

export const categoryBody = z.object({ isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(100).optional() })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' });
export const categoryParam = z.object({ key: z.string().regex(/^[a-z_]{3,20}$/) });
