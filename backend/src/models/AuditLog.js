import mongoose from 'mongoose';

const { Schema } = mongoose;

// An append-only record of what administrators did. Never store secrets, passwords or document contents here.
const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true }, // kept so the record still reads correctly if the account is later renamed or removed
    action: { type: String, required: true },
    targetType: { type: String, required: true }, // property | user | report | verification | category
    targetId: { type: String, required: true },
    summary: { type: String, required: true, maxlength: 300 },
    meta: { type: Schema.Types.Mixed },
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
