import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, PROPERTY_TYPES } from '../config/constants.js';
import { isTest } from '../config/env.js';

const { Schema } = mongoose;
export const BCRYPT_ROUNDS = isTest ? 4 : 12;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, maxlength: 20 },
    avatar: { url: String, publicId: String },
    role: { type: String, enum: ROLES, default: 'buyer' },
    // Public professional profile (agents only). The agent chooses what contact details to publish.
    agentProfile: {
      agencyName: { type: String, trim: true, maxlength: 80 },
      bio: { type: String, trim: true, maxlength: 1500 },
      serviceAreas: { type: [String], default: undefined },
      serviceAreaSlugs: { type: [String], default: undefined }, // lowercase copies for filtering
      specialties: { type: [{ type: String, enum: PROPERTY_TYPES }], default: undefined },
      contactPhone: { type: String, trim: true, maxlength: 20 },
      contactEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
      isListed: { type: Boolean, default: false }, // appears in the agent directory once a profile is saved
    },
    isActive: { type: Boolean, default: true },
    // Three separate concepts: email verification, identity/agent verification (Phase 7), account status.
    emailVerifiedAt: Date,
    verificationStatus: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    passwordChangedAt: Date,
    notificationPrefs: { email: { type: Boolean, default: true } }, // turns off optional emails; security and decision emails are always sent
    suspendedAt: Date,
    suspensionReason: { type: String, maxlength: 500 },
    lastLoginAt: Date,
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1, 'agentProfile.isListed': 1, 'agentProfile.serviceAreaSlugs': 1 });
userSchema.index({ emailVerifyTokenHash: 1 }, { sparse: true });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};
userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

userSchema.set('toJSON', {
  virtuals: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    ret.isEmailVerified = Boolean(ret.emailVerifiedAt);
    delete ret._id; delete ret.__v;
    delete ret.passwordHash;
    delete ret.emailVerifyTokenHash; delete ret.emailVerifyExpiresAt;
    delete ret.passwordResetTokenHash; delete ret.passwordResetExpiresAt;
    delete ret.suspensionReason; delete ret.suspendedAt;
    return ret;
  },
});

export default mongoose.models.User || mongoose.model('User', userSchema);
