import { PURPOSES, PROPERTY_TYPES, FURNISHING, CONDITIONS, AREA_UNITS, AMENITIES, labelOf } from './propertyOptions';
import { formatPKR } from './format';

export const COMMERCIAL_TYPES = ['commercial', 'office', 'shop'];
export const POSTED_OPTIONS = [{ value: '1', label: 'Last 24 hours' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }];
export const SORT_VALUES = ['newest', 'oldest', 'price_asc', 'price_desc', 'relevance'];
export const VIEWS = ['grid', 'list', 'map'];

export const DEFAULT_FILTERS = Object.freeze({
  q: '', purpose: '', type: [], city: '', neighborhood: '', minPrice: '', maxPrice: '', minArea: '', maxArea: '', areaUnit: 'marla',
  bedrooms: '', bathrooms: '', furnishing: '', condition: '', amenities: [], verified: false, postedWithin: '', sort: '', lat: '', lng: '', radiusKm: '',
});

const values = (list) => list.map((o) => o.value);
const oneOf = (v, list) => (list.includes(v) ? v : '');
const many = (v, list) => [...new Set((v || '').split(',').map((x) => x.trim()).filter((x) => list.includes(x)))];
const num = (v) => { if (v == null || v === '') return ''; const n = Number(v); return Number.isFinite(n) && n >= 0 ? String(n) : ''; };
const coord = (v, max) => { if (v == null || v === '') return ''; const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= max ? String(n) : ''; };
const text = (v, max) => (v || '').trim().slice(0, max);

// The URL is the single source of truth. Anything invalid or unknown in it is dropped here, so it can never reach the API.
export function parseFilters(sp) {
  const f = {
    q: text(sp.get('q'), 80), purpose: oneOf(sp.get('purpose'), values(PURPOSES)), type: many(sp.get('type'), values(PROPERTY_TYPES)),
    city: text(sp.get('city'), 60), neighborhood: text(sp.get('neighborhood'), 80),
    minPrice: num(sp.get('minPrice')), maxPrice: num(sp.get('maxPrice')), minArea: num(sp.get('minArea')), maxArea: num(sp.get('maxArea')),
    areaUnit: oneOf(sp.get('areaUnit'), values(AREA_UNITS)) || DEFAULT_FILTERS.areaUnit,
    bedrooms: num(sp.get('bedrooms')), bathrooms: num(sp.get('bathrooms')),
    furnishing: oneOf(sp.get('furnishing'), values(FURNISHING)), condition: oneOf(sp.get('condition'), values(CONDITIONS)),
    amenities: many(sp.get('amenities'), values(AMENITIES)), verified: sp.get('verified') === 'true',
    postedWithin: oneOf(sp.get('postedWithin'), values(POSTED_OPTIONS)), sort: oneOf(sp.get('sort'), SORT_VALUES),
    lat: coord(sp.get('lat'), 90), lng: coord(sp.get('lng'), 180), radiusKm: num(sp.get('radiusKm')),
  };
  if (!f.lat || !f.lng) { f.lat = ''; f.lng = ''; f.radiusKm = ''; }
  return f;
}
export const parseView = (sp) => oneOf(sp.get('view'), VIEWS) || 'grid';
export const parsePage = (sp) => { const n = Math.floor(Number(sp.get('page'))); return Number.isFinite(n) && n >= 1 && n <= 10000 ? n : 1; };

// Filters -> URL. Defaults and empty values are left out, so shared links stay short and readable.
export function toSearchParams(filters, { page = 1, view = 'grid' } = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const sp = new URLSearchParams();
  const put = (k, v) => { if (v !== '' && v !== undefined && v !== null && v !== false) sp.set(k, String(v)); };
  put('q', f.q.trim()); put('purpose', f.purpose);
  if (f.type.length) sp.set('type', f.type.join(','));
  put('city', f.city.trim()); put('neighborhood', f.neighborhood.trim());
  put('minPrice', f.minPrice); put('maxPrice', f.maxPrice); put('minArea', f.minArea); put('maxArea', f.maxArea);
  if (f.minArea || f.maxArea) put('areaUnit', f.areaUnit);
  put('bedrooms', f.bedrooms); put('bathrooms', f.bathrooms); put('furnishing', f.furnishing); put('condition', f.condition);
  if (f.amenities.length) sp.set('amenities', f.amenities.join(','));
  if (f.verified) sp.set('verified', 'true');
  put('postedWithin', f.postedWithin); put('sort', f.sort);
  if (f.lat && f.lng) { put('lat', f.lat); put('lng', f.lng); put('radiusKm', f.radiusKm || '10'); }
  if (view !== 'grid') sp.set('view', view);
  if (page > 1) sp.set('page', String(page));
  return sp;
}

// Filters -> API query (same keys; page and limit added).
export function toApiQuery(filters, { page = 1, limit = 12 } = {}) {
  const sp = toSearchParams(filters, { page, view: 'grid' });
  const q = Object.fromEntries(sp.entries());
  q.page = page; q.limit = limit;
  return q;
}

const range = (lo, hi, fmt, unit = '') => (lo && hi ? `${fmt(lo)} to ${fmt(hi)}${unit}` : lo ? `From ${fmt(lo)}${unit}` : `Up to ${fmt(hi)}${unit}`);

// One removable chip per active filter.
export function activeChips(f) {
  const chips = [];
  // `clear` is either a patch to merge, or a function that returns the new filters.
  const add = (id, label, clear) => chips.push({ id, label, clear: typeof clear === 'function' ? clear : (cur) => ({ ...cur, ...clear }) });
  if (f.q) add('q', `"${f.q}"`, { q: '' });
  if (f.purpose) add('purpose', labelOf(PURPOSES, f.purpose), { purpose: '' });
  f.type.forEach((t) => add(`type:${t}`, labelOf(PROPERTY_TYPES, t), (cur) => ({ ...cur, type: cur.type.filter((x) => x !== t) })));
  if (f.city) add('city', f.city, { city: '', neighborhood: '' });
  if (f.neighborhood) add('neighborhood', f.neighborhood, { neighborhood: '' });
  if (f.minPrice || f.maxPrice) add('price', range(f.minPrice, f.maxPrice, formatPKR), { minPrice: '', maxPrice: '' });
  if (f.minArea || f.maxArea) add('area', range(f.minArea, f.maxArea, (v) => Number(v).toLocaleString('en-PK'), ` ${labelOf(AREA_UNITS, f.areaUnit)}`), { minArea: '', maxArea: '' });
  if (f.bedrooms !== '') add('bedrooms', `${f.bedrooms}+ bedrooms`, { bedrooms: '' });
  if (f.bathrooms !== '') add('bathrooms', `${f.bathrooms}+ bathrooms`, { bathrooms: '' });
  if (f.furnishing) add('furnishing', labelOf(FURNISHING, f.furnishing), { furnishing: '' });
  if (f.condition) add('condition', labelOf(CONDITIONS, f.condition), { condition: '' });
  f.amenities.forEach((a) => add(`amenity:${a}`, labelOf(AMENITIES, a), (cur) => ({ ...cur, amenities: cur.amenities.filter((x) => x !== a) })));
  if (f.verified) add('verified', 'Verified listers', { verified: false });
  if (f.postedWithin) add('posted', labelOf(POSTED_OPTIONS, f.postedWithin), { postedWithin: '' });
  if (f.lat && f.lng) add('near', `Within ${f.radiusKm || 10} km of you`, { lat: '', lng: '', radiusKm: '' });
  return chips;
}
