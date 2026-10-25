import AuditLog from '../models/AuditLog.js';
import { paginationMeta } from '../utils/response.js';

// Writes never throw: a logging problem must not undo an action that already happened. Failures are logged loudly instead.
export async function recordAudit(actor, { action, targetType, targetId, summary, meta, ip }) {
  try {
    await AuditLog.create({ actor: actor._id, actorName: actor.name, action, targetType, targetId: String(targetId), summary: String(summary).slice(0, 300), meta, ip });
  } catch (err) {
    console.error(`AUDIT WRITE FAILED (${action} ${targetType} ${targetId}):`, err.message);
  }
}

const serialize = (l) => ({
  id: String(l._id), action: l.action, targetType: l.targetType, targetId: l.targetId, summary: l.summary, meta: l.meta, createdAt: l.createdAt,
  actor: { id: String(l.actor?._id ?? l.actor), name: l.actor?.name || l.actorName },
});

export async function listAudit({ page, limit, action, targetType, actor, from, to }) {
  const filter = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (actor) filter.actor = actor;
  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: new Date(to.getTime() + 86400000 - 1) }) }; // "to" includes the whole day
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name').lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items: rows.map(serialize), meta: paginationMeta({ page, limit, total }) };
}
