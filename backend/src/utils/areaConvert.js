import { AREA_UNITS } from '../config/constants.js';

/** Convert a value in any supported unit to square feet (rounded to 2 dp). */
export function toSqft(value, unit) {
  const factor = AREA_UNITS[unit];
  if (!factor) throw new Error(`Unsupported area unit: ${unit}`);
  if (!Number.isFinite(value) || value < 0) throw new Error('Area must be a finite, non-negative number');
  return Math.round(value * factor * 100) / 100;
}

/** Convert square feet to a display unit (rounded to 2 dp). */
export function fromSqft(sqft, unit) {
  const factor = AREA_UNITS[unit];
  if (!factor) throw new Error(`Unsupported area unit: ${unit}`);
  return Math.round((sqft / factor) * 100) / 100;
}
