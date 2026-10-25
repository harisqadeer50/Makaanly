import { cloudinaryUrl } from './images';
import { PURPOSES, PROPERTY_TYPES, labelOf } from './propertyOptions';
import { formatPrice, locationLine } from './format';

export const siteUrl = () => (import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
export const trimText = (s = '', n = 155) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };

// Listing text is written by users, so it must never be able to close the script tag it is placed in.
export const safeJson = (data) => JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const PLURAL = { house: 'Houses', apartment: 'Apartments', plot: 'Plots', commercial: 'Commercial properties', office: 'Offices', shop: 'Shops' };
const COMMERCIAL = ['commercial', 'office', 'shop'];

// "Houses for sale in Lahore", "Properties to rent in Karachi", ...
export function searchTitle(f) {
  const types = f.type || [];
  const what = types.length === 1 ? PLURAL[types[0]] : types.length && types.every((t) => COMMERCIAL.includes(t)) ? 'Commercial properties' : 'Properties';
  const purpose = f.purpose === 'sale' ? ' for sale' : f.purpose === 'rent' ? ' for rent' : '';
  return `${what}${purpose}${f.city ? ` in ${f.city}` : ''}`;
}

// Only simple searches (purpose, type, city) are worth indexing, and only the first page. Everything else points back to the base page or is kept out.
export function searchSeo(filters, page, { site = siteUrl() } = {}) {
  const base = new URLSearchParams();
  if (filters.purpose) base.set('purpose', filters.purpose);
  if (filters.city) base.set('city', filters.city);
  if (filters.type?.length) base.set('type', [...filters.type].sort().join(','));
  const qs = base.toString();
  const refined = Boolean(filters.q || filters.neighborhood || filters.minPrice || filters.maxPrice || filters.minArea || filters.maxArea || filters.bedrooms !== '' || filters.bathrooms !== ''
    || filters.furnishing || filters.condition || filters.amenities?.length || filters.verified || filters.postedWithin || filters.lat || filters.sort);
  return { canonical: `${site}/properties${qs ? `?${qs}` : ''}`, noindex: refined || page > 1 };
}

export function propertySeo(p, { preview = false, site = siteUrl() } = {}) {
  const url = `${site}/properties/${p.slug}`;
  const where = locationLine(p.location);
  const live = p.status === 'published' && !preview;
  const images = (p.images || []).slice(0, 5).map((i) => cloudinaryUrl(i.url, { w: 1200, h: 630 }));
  return {
    title: `${p.title}${p.location?.city ? ` | ${labelOf(PURPOSES, p.purpose).toLowerCase()} in ${where}` : ''}`,
    description: trimText(`${formatPrice(p)}. ${labelOf(PROPERTY_TYPES, p.propertyType)} ${labelOf(PURPOSES, p.purpose).toLowerCase()} in ${where}. ${p.description}`),
    canonical: url, type: 'article', image: images[0], noindex: !live, // sold, rented, paused and preview pages stay out of search results
    jsonLd: live ? [
      {
        '@context': 'https://schema.org', '@type': 'RealEstateListing', name: p.title, url, description: trimText(p.description, 300), datePosted: p.publishedAt, ...(images.length ? { image: images } : {}),
        // Only the neighborhood and city, never the street address.
        about: { '@type': 'Place', name: where, address: { '@type': 'PostalAddress', addressLocality: p.location?.city, addressCountry: 'PK' } },
      },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', site], ['Properties', `${site}/properties`], [p.title, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
    ] : undefined,
  };
}

export function agentSeo(a, { site = siteUrl() } = {}) {
  const url = `${site}/agents/${a.id}`;
  return {
    title: `${a.name}${a.agencyName ? `, ${a.agencyName}` : ''} | real estate agent`, description: trimText(a.bio || `${a.name} lists properties on Makaanly.`), canonical: url, image: a.avatarUrl ? cloudinaryUrl(a.avatarUrl, { w: 600, h: 600 }) : undefined,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'RealEstateAgent', name: a.name, url, ...(a.bio ? { description: trimText(a.bio, 300) } : {}), ...(a.avatarUrl ? { image: a.avatarUrl } : {}),
      // Only the contact details the agent chose to publish.
      ...(a.contactPhone ? { telephone: a.contactPhone } : {}), ...(a.contactEmail ? { email: a.contactEmail } : {}),
      ...(a.agencyName ? { worksFor: { '@type': 'Organization', name: a.agencyName } } : {}), ...(a.serviceAreas?.length ? { areaServed: a.serviceAreas.map((name) => ({ '@type': 'Place', name })) } : {}),
    },
  };
}

export const websiteJsonLd = (site = siteUrl()) => ({
  '@context': 'https://schema.org', '@type': 'WebSite', name: 'Makaanly', url: site,
  potentialAction: { '@type': 'SearchAction', target: `${site}/properties?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
});
