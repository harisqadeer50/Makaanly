// Mirrors backend/src/config/constants.js. The server remains the source of truth.
export const PURPOSES = [{ value: 'sale', label: 'For sale' }, { value: 'rent', label: 'For rent' }];
export const PROPERTY_TYPES = [
  { value: 'house', label: 'House' }, { value: 'apartment', label: 'Apartment / flat' }, { value: 'plot', label: 'Plot / land' },
  { value: 'commercial', label: 'Commercial' }, { value: 'office', label: 'Office' }, { value: 'shop', label: 'Shop' },
];
export const CONDITIONS = [
  { value: 'new', label: 'New' }, { value: 'used', label: 'Used' },
  { value: 'under_construction', label: 'Under construction' }, { value: 'renovated', label: 'Renovated' },
];
export const FURNISHING = [
  { value: 'unfurnished', label: 'Unfurnished' }, { value: 'semi_furnished', label: 'Semi-furnished' }, { value: 'furnished', label: 'Furnished' },
];
export const RENTAL_PERIODS = [{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly' }];
export const AREA_UNITS = [
  { value: 'marla', label: 'Marla' }, { value: 'kanal', label: 'Kanal' }, { value: 'sqft', label: 'Square feet' }, { value: 'sqyd', label: 'Square yards' },
];
export const AMENITIES = [
  ['parking', 'Parking'], ['garden', 'Garden'], ['lawn', 'Lawn'], ['balcony', 'Balcony'], ['terrace', 'Terrace'],
  ['swimming_pool', 'Swimming pool'], ['gym', 'Gym'], ['elevator', 'Elevator'], ['security', 'Security guard'], ['cctv', 'CCTV'],
  ['backup_power', 'Backup power'], ['gas', 'Gas'], ['water_supply', 'Water supply'], ['internet', 'Internet'], ['central_ac', 'Central A/C'],
  ['servant_quarter', 'Servant quarter'], ['study_room', 'Study room'], ['store_room', 'Store room'], ['gated_community', 'Gated community'],
  ['corner_plot', 'Corner plot'], ['near_school', 'Near school'], ['near_hospital', 'Near hospital'], ['near_park', 'Near park'], ['near_public_transport', 'Near public transport'],
].map(([value, label]) => ({ value, label }));
export const STATUS_LABELS = {
  draft: 'Draft', pending_review: 'Pending review', published: 'Published', rejected: 'Rejected',
  paused: 'Paused', sold: 'Sold', rented: 'Rented', archived: 'Archived',
};
export const STATUS_TONES = {
  draft: 'neutral', pending_review: 'amber', published: 'green', rejected: 'red', paused: 'amber', sold: 'navy', rented: 'navy', archived: 'neutral',
};
export const labelOf = (list, value) => list.find((o) => o.value === value)?.label ?? value;
