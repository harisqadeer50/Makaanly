import mongoose from 'mongoose';
import { APPOINTMENT_STATUSES } from '../config/constants.js';

const { Schema } = mongoose;

const appointmentSchema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    propertyTitle: { type: String, required: true },
    propertySlug: { type: String, required: true },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // derived on the server from the listing
    requestedStart: { type: Date, required: true }, // UTC
    requestedEnd: { type: Date, required: true },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'requested' },
    message: { type: String, trim: true, maxlength: 500 },
    contactPhone: { type: String, trim: true, maxlength: 20 },
    declineReason: { type: String, trim: true, maxlength: 300 },
    cancelledBy: { type: String, enum: ['host', 'requester'] },
    confirmedAt: Date,
  },
  { timestamps: true },
);

appointmentSchema.index({ host: 1, status: 1, requestedStart: 1 }); // conflict checks
appointmentSchema.index({ requester: 1, requestedStart: -1 });
appointmentSchema.index({ property: 1 });

export default mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
