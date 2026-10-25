import mongoose from 'mongoose';
import { PROPERTY_TYPES } from '../config/constants.js';

const { Schema } = mongoose;

// Property types are fixed in code (they drive validation and search). Admins decide which are offered and in what order.
const categorySchema = new Schema(
  {
    key: { type: String, enum: PROPERTY_TYPES, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true },
);

export default mongoose.models.Category || mongoose.model('Category', categorySchema);
