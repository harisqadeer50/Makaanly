import mongoose from 'mongoose';
import {
  PURPOSES, PROPERTY_TYPES, PROPERTY_STATUSES, AREA_UNIT_KEYS, CURRENCIES, RENTAL_PERIODS,
  FURNISHING, CONDITIONS, AMENITIES,
} from '../config/constants.js';
import { toSqft } from '../utils/areaConvert.js';
import { slugify } from '../utils/slug.js';

const { Schema } = mongoose;

const imageSchema = new Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  isCover: { type: Boolean, default: false },
  altText: { type: String, maxlength: 160, default: '' },
});

const int = (min, max) => ({ type: Number, min, max, validate: { validator: Number.isInteger, message: '{PATH} must be a whole number' } });

const propertySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 10, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    referenceId: { type: String, required: true, unique: true },
    description: { type: String, required: true, trim: true, minlength: 30, maxlength: 5000 },
    purpose: { type: String, enum: PURPOSES, required: true },
    propertyType: { type: String, enum: PROPERTY_TYPES, required: true },
    condition: { type: String, enum: CONDITIONS, default: 'used' },

    price: { type: Number, required: true, min: 1, max: 1e11 },
    currency: { type: String, enum: CURRENCIES, default: 'PKR' },
    rentalPeriod: { type: String, enum: RENTAL_PERIODS },
    negotiable: { type: Boolean, default: false },
    maintenanceCharges: { type: Number, min: 0, max: 1e9 },
    securityDeposit: { type: Number, min: 0, max: 1e10 },

    // Original values and unit as entered, plus normalized square feet for filtering and sorting.
    coveredArea: { type: Number, min: 0, max: 1e7 },
    plotArea: { type: Number, min: 0, max: 1e7 },
    areaUnit: { type: String, enum: AREA_UNIT_KEYS, default: 'sqft' },
    coveredAreaSqft: Number,
    plotAreaSqft: Number,
    areaSqft: { type: Number, required: [true, 'Enter the covered area or plot area'], min: 1 },

    bedrooms: int(0, 20),
    bathrooms: int(0, 20),
    kitchens: int(0, 10),
    floors: int(0, 200),
    parkingSpaces: int(0, 50),
    constructionYear: int(1900, 2100),
    furnishing: { type: String, enum: FURNISHING },
    amenities: { type: [{ type: String, enum: AMENITIES }], default: [] },

    location: {
      country: { type: String, default: 'Pakistan', trim: true },
      city: { type: String, required: true, trim: true, maxlength: 60 },
      citySlug: { type: String }, // lowercase, derived from city: exact filters that can use an index
      neighborhood: { type: String, required: true, trim: true, maxlength: 80 },
      neighborhoodSlug: { type: String },
      area: { type: String, trim: true, maxlength: 80 },
      street: { type: String, trim: true, maxlength: 160 },
      hideExactAddress: { type: Boolean, default: true },
      geo: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number], default: undefined }, // [longitude, latitude]
      },
    },

    images: { type: [imageSchema], default: [] },

    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: 'User' },

    status: { type: String, enum: PROPERTY_STATUSES, default: 'draft' },
    rejectionReason: { type: String, maxlength: 500 },
    pausedReason: { type: String, enum: ['owner_suspended'] }, // set when a listing is paused because its owner was suspended
    moderationNote: { type: String, maxlength: 1000 }, // internal, admins only
    isFeatured: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0, min: 0 },
    publishedAt: Date,
    expiresAt: Date,
  },
  { timestamps: true },
);

propertySchema.pre('validate', function normalize(next) {
  try {
    if (this.isNew || this.isModified('coveredArea') || this.isModified('plotArea') || this.isModified('areaUnit')) {
      this.coveredAreaSqft = this.coveredArea > 0 ? toSqft(this.coveredArea, this.areaUnit) : undefined;
      this.plotAreaSqft = this.plotArea > 0 ? toSqft(this.plotArea, this.areaUnit) : undefined;
      this.areaSqft = this.coveredAreaSqft ?? this.plotAreaSqft;
    }
  } catch (err) {
    this.invalidate('coveredArea', err.message);
  }
  if (this.location) {
    this.location.citySlug = slugify(this.location.city);
    this.location.neighborhoodSlug = slugify(this.location.neighborhood);
  }
  if (this.purpose === 'sale') { this.rentalPeriod = undefined; this.securityDeposit = undefined; }
  if (this.purpose === 'rent' && !this.rentalPeriod) this.rentalPeriod = 'monthly';
  next();
});

// Public search and browsing
propertySchema.index({ status: 1, purpose: 1, 'location.citySlug': 1, propertyType: 1, price: 1 });
propertySchema.index({ status: 1, 'location.citySlug': 1, 'location.neighborhoodSlug': 1 });
propertySchema.index({ status: 1, areaSqft: 1 });
propertySchema.index({ status: 1, publishedAt: -1 });
propertySchema.index({ status: 1, isFeatured: 1, publishedAt: -1 });
propertySchema.index({ owner: 1, status: 1, updatedAt: -1 });
propertySchema.index({ assignedAgent: 1, status: 1 }, { sparse: true });
propertySchema.index({ 'location.geo': '2dsphere' });
propertySchema.index(
  { title: 'text', description: 'text', 'location.city': 'text', 'location.neighborhood': 'text' },
  { weights: { title: 5, 'location.neighborhood': 3, 'location.city': 3, description: 1 }, name: 'property_text' },
);

export default mongoose.models.Property || mongoose.model('Property', propertySchema);
