import { AREA_UNITS, RENTAL_PERIODS, labelOf } from './propertyOptions';

const trim = (n) => Number(n.toFixed(2)).toString();
const PERIOD = { monthly: 'month', quarterly: 'quarter', yearly: 'year' };

export function formatPrice(p) {
  const n = Number(p.price);
  let text;
  if (p.currency === 'PKR' || !p.currency) {
    text = n >= 1e7 ? `${trim(n / 1e7)} Crore` : n >= 1e5 ? `${trim(n / 1e5)} Lakh` : n.toLocaleString('en-PK');
    text = `PKR ${text}`;
  } else {
    text = new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(n);
  }
  return p.purpose === 'rent' ? `${text} / ${PERIOD[p.rentalPeriod || 'monthly']}` : text;
}

// "PKR 50 Lakh", "PKR 1.5 Crore", "PKR 85,000"
export function formatPKR(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const t = n >= 1e7 ? `${trim(n / 1e7)} Crore` : n >= 1e5 ? `${trim(n / 1e5)} Lakh` : n.toLocaleString('en-PK');
  return `PKR ${t}`;
}

export const formatMoney = (n, currency = 'PKR') => `${currency} ${Number(n).toLocaleString('en-PK')}`;

export function formatArea(value, unit) {
  if (!value) return null;
  const label = { marla: 'Marla', kanal: 'Kanal', sqft: 'sq ft', sqyd: 'sq yd' }[unit] ?? unit;
  return `${Number(value).toLocaleString('en-PK')} ${label}`;
}
export const primaryArea = (p) => formatArea(p.coveredArea || p.plotArea, p.areaUnit);
export const periodLabel = (v) => labelOf(RENTAL_PERIODS, v);
export const unitLabel = (v) => labelOf(AREA_UNITS, v);

export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export const locationLine = (loc) => [loc?.neighborhood, loc?.city].filter(Boolean).join(', ');
