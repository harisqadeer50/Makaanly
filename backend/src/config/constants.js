// Single source of truth for enums and conversion constants.
export const ROLES = Object.freeze(['buyer', 'owner', 'agent', 'admin']);
// Roles a person may pick at public registration. Never includes "admin".
export const REGISTERABLE_ROLES = Object.freeze(['buyer', 'owner', 'agent']);

export const PURPOSES = Object.freeze(['sale', 'rent']);
export const PROPERTY_TYPES = Object.freeze([
  'house', 'apartment', 'plot', 'commercial', 'office', 'shop',
]);
export const PROPERTY_STATUSES = Object.freeze([
  'draft', 'pending_review', 'published', 'rejected',
  'paused', 'sold', 'rented', 'archived',
]);

// Square feet per unit. Marla size varies by region; 272.25 sq ft is the
// common Punjab/Islamabad standard (documented in README). 1 kanal = 20 marla.
export const AREA_UNITS = Object.freeze({
  sqft: 1,
  sqyd: 9,
  marla: 272.25,
  kanal: 5445,
});
export const AREA_UNIT_KEYS = Object.freeze(Object.keys(AREA_UNITS));

export const DEFAULT_CITIES = Object.freeze([
  'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad',
]);

// ---- Property listings (Phase 3) ----
export const CURRENCIES = Object.freeze(['PKR', 'USD']);
export const RENTAL_PERIODS = Object.freeze(['monthly', 'quarterly', 'yearly']);
export const FURNISHING = Object.freeze(['unfurnished', 'semi_furnished', 'furnished']);
export const CONDITIONS = Object.freeze(['new', 'used', 'under_construction', 'renovated']);
export const AMENITIES = Object.freeze([
  'parking', 'garden', 'lawn', 'balcony', 'terrace', 'swimming_pool', 'gym', 'elevator',
  'security', 'cctv', 'backup_power', 'gas', 'water_supply', 'internet', 'central_ac',
  'servant_quarter', 'study_room', 'store_room', 'gated_community', 'corner_plot',
  'near_school', 'near_hospital', 'near_park', 'near_public_transport',
]);
// Statuses a visitor may open by URL. Sold/rented pages show an "unavailable" banner.
export const PUBLIC_VISIBLE_STATUSES = Object.freeze(['published', 'sold', 'rented']);
// Photos required before a listing can be submitted for review (and kept while it is live).
export const MIN_IMAGES_FOR_REVIEW = 1;
export const LISTING_TTL_DAYS = 90;

// ---- Property images (Phase 4) ----
export const MAX_IMAGES_PER_PROPERTY = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

// ---- Marketplace (Phase 6) ----
export const INQUIRY_STATUSES = Object.freeze(['new', 'read', 'replied', 'closed']);
export const OPEN_INQUIRY_STATUSES = Object.freeze(['new', 'read', 'replied']);
export const APPOINTMENT_STATUSES = Object.freeze(['requested', 'confirmed', 'rescheduled', 'declined', 'cancelled', 'completed']);
export const REPORT_REASONS = Object.freeze([
  'misleading_info', 'wrong_price', 'already_sold', 'fake_listing', 'suspected_scam', 'inappropriate_content', 'duplicate', 'other',
]);
export const OPEN_REPORT_STATUSES = Object.freeze(['open', 'under_review']);
export const REPORT_STATUSES = Object.freeze(['open', 'under_review', 'resolved', 'dismissed']);

// All times are stored in UTC and shown in Pakistan time (UTC+5, no daylight saving).
export const APP_TIMEZONE = 'Asia/Karachi';
export const VIEWING = Object.freeze({ slotMinutes: [30, 60], openHour: 9, closeHour: 20, maxDaysAhead: 60, minLeadMinutes: 60, maxActivePerUser: 10 });
export const MAX_FAVORITES = 200;
export const MAX_INQUIRY_REPLIES = 50;

// ---- Administration (Phase 7) ----
export const VERIFICATION_TYPES = Object.freeze(['agent', 'owner']);
export const VERIFICATION_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'revoked']);
export const MAX_VERIFICATION_DOCUMENTS = 3;
export const VERIFICATION_DOC_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const DOCUMENT_LINK_SECONDS = 300; // how long an admin's download link for a verification document works
export const AUDIT_ACTIONS = Object.freeze([
  'listing.create', 'listing.update', 'listing.status', 'listing.delete', 'listing.images', 'listing.approve', 'listing.reject', 'listing.feature',
  'user.suspend', 'user.reactivate', 'report.update', 'verification.approve', 'verification.reject', 'verification.revoke', 'verification.view_document', 'category.update',
]);
