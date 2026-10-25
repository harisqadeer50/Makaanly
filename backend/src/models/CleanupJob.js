import mongoose from 'mongoose';

const { Schema } = mongoose;

// A Cloudinary asset that could not be deleted right away. A background worker retries it with backoff,
// so the database and Cloudinary never drift apart for long.
const cleanupJobSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true },
    deliveryType: { type: String, default: 'upload' }, // 'authenticated' for private documents
    resourceType: { type: String, default: 'image' },
    status: { type: String, enum: ['pending', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: String,
  },
  { timestamps: true },
);
cleanupJobSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.models.CleanupJob || mongoose.model('CleanupJob', cleanupJobSchema);
