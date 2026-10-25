import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, maxlength: 40 }, // e.g. inquiry.new, appointment.confirmed, listing.approved
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, maxlength: 300, default: '' },
    link: { type: String, maxlength: 200 }, // an in-app path, e.g. /dashboard/inquiries/<id>
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 }); // history is kept for 180 days

export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
