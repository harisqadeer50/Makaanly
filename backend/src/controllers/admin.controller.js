import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { adminStats } from '../services/adminStats.service.js';
import * as users from '../services/adminUsers.service.js';
import * as properties from '../services/adminProperties.service.js';
import * as reports from '../services/adminReports.service.js';
import * as verification from '../services/verification.service.js';
import * as categories from '../services/category.service.js';
import { listAudit } from '../services/audit.service.js';

export const dashboard = asyncHandler(async (_req, res) => ok(res, await adminStats()));

export const listUsers = asyncHandler(async (req, res) => { const r = await users.listUsers(req.query); ok(res, { users: r.items }, r.meta); });
export const getUser = asyncHandler(async (req, res) => ok(res, { user: await users.getUser(req.params.id) }));
export const setUserStatus = asyncHandler(async (req, res) => ok(res, { user: await users.setUserStatus(req.user, req.params.id, req.body, req.ip) }));

export const listProperties = asyncHandler(async (req, res) => { const r = await properties.listAll(req.query); ok(res, { properties: r.items }, r.meta); });
export const pendingProperties = asyncHandler(async (req, res) => { const r = await properties.pendingQueue(req.query); ok(res, { properties: r.items }, r.meta); });
export const moderate = asyncHandler(async (req, res) => ok(res, { property: await properties.moderate(req.user, req.params.id, req.body, req.ip) }));
export const setFeatured = asyncHandler(async (req, res) => ok(res, { property: await properties.setFeatured(req.user, req.params.id, req.body.isFeatured, req.ip) }));

export const listReports = asyncHandler(async (req, res) => { const r = await reports.listReports(req.query); ok(res, { reports: r.items }, r.meta); });
export const updateReport = asyncHandler(async (req, res) => ok(res, { report: await reports.updateReport(req.user, req.params.id, req.body, req.ip) }));

export const listVerifications = asyncHandler(async (req, res) => { const r = await verification.listRequests(req.query); ok(res, { verifications: r.items }, r.meta); });
export const verificationDocument = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store'); // a one-time link must never be cached
  ok(res, await verification.documentLink(req.user, req.params.id, req.params.docId, req.ip));
});
export const decideVerification = asyncHandler(async (req, res) => ok(res, { verification: await verification.decide(req.user, req.params.id, req.body, req.ip) }));

export const auditLogs = asyncHandler(async (req, res) => { const r = await listAudit(req.query); ok(res, { logs: r.items }, r.meta); });

export const listCategories = asyncHandler(async (_req, res) => ok(res, { categories: await categories.listCategories() }));
export const updateCategory = asyncHandler(async (req, res) => ok(res, { category: await categories.updateCategory(req.user, req.params.key, req.body, req.ip) }));
