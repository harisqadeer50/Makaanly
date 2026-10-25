import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { serializeInquiry, serializeAppointment } from '../utils/marketplaceSerializer.js';
import * as favorites from '../services/favorite.service.js';
import * as inquiries from '../services/inquiry.service.js';
import * as appointments from '../services/appointment.service.js';
import * as reports from '../services/report.service.js';
import * as agents from '../services/agent.service.js';
import * as users from '../services/user.service.js';
import * as dashboard from '../services/dashboard.service.js';

// favorites
export const listFavorites = asyncHandler(async (req, res) => ok(res, { properties: await favorites.listFavorites(req.user) }));
export const favoriteIds = asyncHandler(async (req, res) => ok(res, { ids: await favorites.favoriteIds(req.user) }));
export const addFavorite = asyncHandler(async (req, res) => created(res, await favorites.addFavorite(req.user, req.params.propertyId)));
export const removeFavorite = asyncHandler(async (req, res) => ok(res, await favorites.removeFavorite(req.user, req.params.propertyId)));

// inquiries
export const createInquiry = asyncHandler(async (req, res) => {
  const inquiry = await inquiries.createInquiry(req.user, req.body);
  created(res, { inquiry: serializeInquiry({ ...inquiry.toObject(), recipient: inquiry.recipient }, req.user._id) });
});
export const sentInquiries = asyncHandler(async (req, res) => { const r = await inquiries.listSent(req.user, req.query); ok(res, { inquiries: r.items }, r.meta); });
export const receivedInquiries = asyncHandler(async (req, res) => { const r = await inquiries.listReceived(req.user, req.query); ok(res, { inquiries: r.items }, r.meta); });
export const getInquiry = asyncHandler(async (req, res) => ok(res, { inquiry: await inquiries.getInquiry(req.params.id, req.user) }));
export const setInquiryStatus = asyncHandler(async (req, res) => ok(res, { inquiry: await inquiries.setStatus(req.params.id, req.user, req.body.status) }));
export const replyToInquiry = asyncHandler(async (req, res) => created(res, { inquiry: await inquiries.addReply(req.params.id, req.user, req.body.message) }));

// appointments
export const createAppointment = asyncHandler(async (req, res) => {
  const a = await appointments.createAppointment(req.user, req.body);
  created(res, { appointment: serializeAppointment(a, req.user._id) });
});
export const myAppointments = asyncHandler(async (req, res) => { const r = await appointments.listMine(req.user, req.query); ok(res, { appointments: r.items }, r.meta); });
export const receivedAppointments = asyncHandler(async (req, res) => { const r = await appointments.listReceived(req.user, req.query); ok(res, { appointments: r.items }, r.meta); });
export const actOnAppointment = asyncHandler(async (req, res) => ok(res, { appointment: await appointments.act(req.params.id, req.user, req.body) }));
export const cancelAppointment = asyncHandler(async (req, res) => ok(res, { appointment: await appointments.cancel(req.params.id, req.user, req.body.reason) }));

// reports
export const reportProperty = asyncHandler(async (req, res) => created(res, await reports.createReport(req.user, req.params.id, req.body)));

// agents
export const listAgents = asyncHandler(async (req, res) => { const r = await agents.listAgents(req.query); ok(res, { agents: r.items }, r.meta); });
export const getAgent = asyncHandler(async (req, res) => ok(res, { agent: await agents.getAgent(req.params.id) }));
export const updateAgentProfile = asyncHandler(async (req, res) => ok(res, { user: await agents.updateProfile(req.user, req.body) }));

// account
export const updateMe = asyncHandler(async (req, res) => ok(res, { user: await users.updateMe(req.user, req.body) }));
export const setPreferences = asyncHandler(async (req, res) => ok(res, { user: await users.setPreferences(req.user, req.body) }));
export const setAvatar = asyncHandler(async (req, res) => ok(res, { user: await users.setAvatar(req.user, req.files[0]) }));
export const removeAvatar = asyncHandler(async (req, res) => ok(res, { user: await users.removeAvatar(req.user) }));
export const dashboardSummary = asyncHandler(async (req, res) => ok(res, await dashboard.summary(req.user)));
