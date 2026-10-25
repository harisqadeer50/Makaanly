import crypto from 'node:crypto';

export const slugify = (s = '') =>
  s.toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alike characters
export function shortId(len = 5) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// Readable and unique: "3-bed-house-near-park-lahore-x7k2p". Generated once, never changes when the title is edited.
export function buildSlug(title, city) {
  const t = slugify(title).slice(0, 60).replace(/-+$/, '') || 'property';
  return [t, slugify(city), shortId(5)].filter(Boolean).join('-');
}
export const buildReferenceId = () => `GF-${shortId(7).toUpperCase()}`;
