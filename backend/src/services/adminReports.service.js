import Report from '../models/Report.js';
import Property from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta } from '../utils/response.js';
import { changeStatus } from './property.service.js';
import { recordAudit } from './audit.service.js';
import { notify } from './notification.service.js';

export const REPORT_TRANSITIONS = Object.freeze({ open: ['under_review', 'resolved', 'dismissed'], under_review: ['resolved', 'dismissed'], resolved: [], dismissed: [] });

const serialize = (r) => ({
  id: String(r._id), reason: r.reason, description: r.description || null, status: r.status, resolution: r.resolution || null, createdAt: r.createdAt, reviewedAt: r.reviewedAt || null,
  reporter: r.reporter?.name ? { id: String(r.reporter._id), name: r.reporter.name, email: r.reporter.email } : null,
  property: r.property?.title ? { id: String(r.property._id), title: r.property.title, slug: r.property.slug, status: r.property.status } : { id: String(r.property?._id ?? r.property), title: r.propertyTitle, slug: null, status: 'removed' },
  reviewedBy: r.reviewedBy?.name || null,
});

export async function listReports({ page, limit, status, property }) {
  const filter = { ...(status && { status }), ...(property && { property }) };
  const [rows, total] = await Promise.all([
    Report.find(filter).sort({ status: 1, createdAt: 1 }).skip((page - 1) * limit).limit(limit)
      .populate('reporter', 'name email').populate('property', 'title slug status').populate('reviewedBy', 'name').lean(),
    Report.countDocuments(filter),
  ]);
  // "open" sorts before "under_review", resolved and dismissed; within a status the oldest report comes first.
  return { items: rows.map(serialize), meta: paginationMeta({ page, limit, total }) };
}

// Resolving can also act on the listing in the same step (pause it, or reject it with the same note as the reason).
export async function updateReport(admin, id, { status, resolution, propertyAction }, ip) {
  const report = await Report.findById(id);
  if (!report) throw ApiError.notFound('Report not found');
  if (!REPORT_TRANSITIONS[report.status].includes(status)) throw ApiError.conflict(`A ${report.status.replace('_', ' ')} report cannot be marked ${status.replace('_', ' ')}.`);

  let listingChange = null;
  if (propertyAction) {
    const property = await Property.findById(report.property);
    if (!property) throw ApiError.conflict('The reported listing no longer exists.');
    const to = propertyAction === 'pause' ? 'paused' : 'rejected';
    await changeStatus(property, to, admin, resolution); // throws (and leaves the report untouched) if the listing cannot make that change
    listingChange = to;
  }
  report.status = status; report.reviewedBy = admin._id; report.reviewedAt = new Date();
  if (resolution) report.resolution = resolution;
  await report.save();
  await recordAudit(admin, {
    action: 'report.update', targetType: 'report', targetId: report._id,
    summary: `Marked report on "${report.propertyTitle}" as ${status.replace('_', ' ')}${listingChange ? ` and set the listing to ${listingChange}` : ''}`, meta: { reason: report.reason, resolution, listingChange }, ip,
  });
  // The reporter hears the outcome, never the internal note.
  if (['resolved', 'dismissed'].includes(status)) notify(report.reporter, { type: 'report.update', title: 'Update on your report', body: `We reviewed your report about "${report.propertyTitle}"${status === 'resolved' ? ' and took action. Thank you for helping keep Makaanly trustworthy.' : '. We did not find a problem that needs action.'}` });
  await report.populate([{ path: 'reporter', select: 'name email' }, { path: 'property', select: 'title slug status' }, { path: 'reviewedBy', select: 'name' }]);
  return serialize(report.toObject());
}
