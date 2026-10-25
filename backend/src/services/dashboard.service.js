import Inquiry from '../models/Inquiry.js';
import Appointment from '../models/Appointment.js';
import Favorite from '../models/Favorite.js';
import { summaryFor } from './property.service.js';

const MANAGERS = ['owner', 'agent', 'admin'];

// Every number comes from the database. Counts that do not apply to a role are left out, not shown as zero.
export async function summary(user) {
  const now = new Date();
  const [favorites, newInquiries, pendingViewings, upcomingViewings, listings] = await Promise.all([
    Favorite.countDocuments({ user: user._id }),
    Inquiry.countDocuments({ recipient: user._id, status: 'new' }),
    Appointment.countDocuments({ host: user._id, status: 'requested' }),
    Appointment.countDocuments({ status: 'confirmed', requestedStart: { $gte: now }, $or: [{ host: user._id }, { requester: user._id }] }),
    MANAGERS.includes(user.role) ? summaryFor(user) : null,
  ]);
  return { favorites, newInquiries, pendingViewings, upcomingViewings, ...(listings ? { listings } : {}) };
}
