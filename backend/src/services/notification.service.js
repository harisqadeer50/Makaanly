import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta } from '../utils/response.js';
import { sendNotificationEmail } from './email.service.js';

export const excerpt = (s = '', n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// Creates an in-app notification and, if asked, an email. It never throws: a problem here must not break the action that caused it.
// Callers do not wait for it. `emailUnlessUnread` sends at most one email while the earlier notification of the same kind is still unread.
export async function notify(userId, { type, title, body = '', link, email = false, emailUnlessUnread = false }) {
  try {
    const user = await User.findById(userId).select('name email isActive notificationPrefs');
    if (!user || !user.isActive) return null;
    const repeat = email && emailUnlessUnread && link && (await Notification.exists({ user: user._id, type, link, readAt: null }));
    const created = await Notification.create({ user: user._id, type, title: title.slice(0, 120), body: body.slice(0, 300), link });
    if (email && !repeat && user.notificationPrefs?.email !== false) {
      await sendNotificationEmail(user, { subject: title, text: body || title, link });
    }
    return created;
  } catch (err) {
    console.error(`Notification (${type}) failed:`, err.message);
    return null;
  }
}

const serialize = (n) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body, link: n.link || null, read: Boolean(n.readAt), createdAt: n.createdAt });

export async function list(user, { page, limit, unread }) {
  const filter = { user: user._id, ...(unread ? { readAt: null } : {}) };
  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: user._id, readAt: null }),
  ]);
  return { items: rows.map(serialize), meta: { ...paginationMeta({ page, limit, total }), unread: unreadCount } };
}

export const unreadCount = (user) => Notification.countDocuments({ user: user._id, readAt: null });

export async function markRead(user, id) {
  const n = await Notification.findOne({ _id: id, user: user._id }); // only your own
  if (!n) throw ApiError.notFound('Notification not found');
  if (!n.readAt) { n.readAt = new Date(); await n.save(); }
  return serialize(n);
}

export async function markAllRead(user) {
  const r = await Notification.updateMany({ user: user._id, readAt: null }, { readAt: new Date() });
  return { updated: r.modifiedCount ?? 0 };
}
