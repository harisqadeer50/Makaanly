import mongoose from 'mongoose';
import { VERIFICATION_TYPES, VERIFICATION_STATUSES } from '../config/constants.js';

const { Schema } = mongoose;

// Documents live in Cloudinary as private ("authenticated") assets. They are shown to reviewers through short-lived links
// and are deleted as soon as a decision is made, so identity documents are not kept longer than needed.
const documentSchema = new Schema({
  publicId: { type: String, required: true },
  format: { type: String, required: true },
  resourceType: { type: String, default: 'image' },
  originalName: { type: String, maxlength: 80 },
  bytes: Number,
});

const verificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    verificationType: { type: String, enum: VERIFICATION_TYPES, required: true },
    status: { type: String, enum: VERIFICATION_STATUSES, default: 'pending' },
    message: { type: String, trim: true, maxlength: 1000 },
    documents: { type: [documentSchema], default: [] },
    documentCount: { type: Number, default: 0 }, // remembered after the files are deleted
    submittedAt: { type: Date, default: Date.now },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);
verificationSchema.index({ status: 1, submittedAt: 1 });
verificationSchema.index({ user: 1, submittedAt: -1 });
verificationSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } }); // one pending request per person

export default mongoose.models.VerificationRequest || mongoose.model('VerificationRequest', verificationSchema);
