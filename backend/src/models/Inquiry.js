import mongoose from 'mongoose';
import { INQUIRY_STATUSES, OPEN_INQUIRY_STATUSES } from '../config/constants.js';

const { Schema } = mongoose;

const replySchema = new Schema(
  { author: { type: Schema.Types.ObjectId, ref: 'User', required: true }, message: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 } },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const inquirySchema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    // Snapshot, so the inbox still makes sense if the listing is later archived or removed.
    propertyTitle: { type: String, required: true },
    propertySlug: { type: String, required: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // always derived on the server from the listing
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    phone: { type: String, trim: true, maxlength: 20 },
    preferredVisitAt: Date,
    status: { type: String, enum: INQUIRY_STATUSES, default: 'new' },
    replies: { type: [replySchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

inquirySchema.index({ recipient: 1, status: 1, lastActivityAt: -1 });
inquirySchema.index({ buyer: 1, lastActivityAt: -1 });
inquirySchema.index({ property: 1 });
// One open conversation per buyer and listing. This is the abuse guard against repeated messages, enforced by the database.
inquirySchema.index({ buyer: 1, property: 1 }, { unique: true, partialFilterExpression: { status: { $in: OPEN_INQUIRY_STATUSES } } });

export default mongoose.models.Inquiry || mongoose.model('Inquiry', inquirySchema);
