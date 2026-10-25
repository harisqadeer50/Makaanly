import mongoose from 'mongoose';

const { Schema } = mongoose;
const favoriteSchema = new Schema(
  { user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, property: { type: Schema.Types.ObjectId, ref: 'Property', required: true } },
  { timestamps: { createdAt: true, updatedAt: false } },
);
favoriteSchema.index({ user: 1, property: 1 }, { unique: true }); // no duplicates, even under concurrent requests
favoriteSchema.index({ property: 1 });
favoriteSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Favorite || mongoose.model('Favorite', favoriteSchema);
