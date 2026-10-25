import User from '../models/User.js';
import Property from '../models/Property.js';
import Inquiry from '../models/Inquiry.js';
import Report from '../models/Report.js';
import VerificationRequest from '../models/VerificationRequest.js';
import AuditLog from '../models/AuditLog.js';
import { APP_TIMEZONE } from '../config/constants.js';
import { localDateKey } from '../utils/timezone.js';

const DAY = 86400000;
const dayKeys = (days, now) => Array.from({ length: days }, (_, i) => localDateKey(new Date(now.getTime() - (days - 1 - i) * DAY)));

// Pure helpers: days with no activity still appear, as zero, so charts have a point for every day.
export function series(rows, { days = 30, now = new Date() } = {}) {
  const by = new Map(rows.map((r) => [r._id, r.n]));
  return dayKeys(days, now).map((date) => ({ date, count: by.get(date) || 0 }));
}
export function multiSeries(rows, fields, { days = 30, now = new Date() } = {}) {
  const by = new Map(rows.map((r) => [`${r._id.day}|${r._id.action}`, r.n]));
  return dayKeys(days, now).map((date) => ({ date, ...Object.fromEntries(Object.entries(fields).map(([name, action]) => [name, by.get(`${date}|${action}`) || 0])) }));
}

const perDay = (field) => [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: APP_TIMEZONE } }, n: { $sum: 1 } } }];

// Every figure comes from the database; nothing is estimated or filled in.
export async function adminStats(now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY);
  const [roles, statuses, newInquiries, inquiries7, reportsOpen, reportsReview, verifications, cities, regs, inqDaily, moderation] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 }, suspended: { $sum: { $cond: ['$isActive', 0, 1] } } } }]),
    Property.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Inquiry.countDocuments({ status: 'new' }),
    Inquiry.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * DAY) } }),
    Report.countDocuments({ status: 'open' }),
    Report.countDocuments({ status: 'under_review' }),
    VerificationRequest.countDocuments({ status: 'pending' }),
    Property.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$location.citySlug', name: { $first: '$location.city' }, n: { $sum: 1 } } }, { $sort: { n: -1, name: 1 } }, { $limit: 8 }]),
    User.aggregate([{ $match: { createdAt: { $gte: since } } }, ...perDay('createdAt')]),
    Inquiry.aggregate([{ $match: { createdAt: { $gte: since } } }, ...perDay('createdAt')]),
    AuditLog.aggregate([
      { $match: { action: { $in: ['listing.approve', 'listing.reject'] }, createdAt: { $gte: since } } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: APP_TIMEZONE } }, action: '$action' }, n: { $sum: 1 } } },
    ]),
  ]);
  const byRole = Object.fromEntries(roles.map((r) => [r._id, r.total]));
  const total = roles.reduce((n, r) => n + r.total, 0);
  const suspended = roles.reduce((n, r) => n + r.suspended, 0);
  const byStatus = Object.fromEntries(statuses.map((r) => [r._id, r.n]));
  return {
    users: { total, active: total - suspended, suspended, byRole },
    listings: { total: statuses.reduce((n, r) => n + r.n, 0), byStatus, published: byStatus.published || 0, pending: byStatus.pending_review || 0, rejected: byStatus.rejected || 0 },
    inquiries: { new: newInquiries, last7Days: inquiries7 },
    reports: { open: reportsOpen, underReview: reportsReview },
    verifications: { pending: verifications },
    listingsByCity: cities.map((c) => ({ name: c.name, count: c.n })),
    registrations: series(regs, { now }),
    inquiriesPerDay: series(inqDaily, { now }),
    moderation: multiSeries(moderation, { approved: 'listing.approve', rejected: 'listing.reject' }, { now }),
  };
}
