import mongoose from 'mongoose';
import { REPORT_REASONS, REPORT_STATUSES, OPEN_REPORT_STATUSES } from '../config/constants.js';

const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    propertyTitle: { type: String, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: REPORT_STATUSES, default: 'open' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    resolution: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ property: 1, status: 1 });
// A person can have only one unresolved report per listing.
reportSchema.index({ reporter: 1, property: 1 }, { unique: true, partialFilterExpression: { status: { $in: OPEN_REPORT_STATUSES } } });

export default mongoose.models.Report || mongoose.model('Report', reportSchema);
