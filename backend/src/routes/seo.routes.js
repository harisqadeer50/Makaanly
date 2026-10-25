import { Router } from 'express';
import Property from '../models/Property.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

const STATIC_PAGES = ['/', '/properties', '/agents', '/safety', '/support', '/privacy', '/terms'];
const MAX_URLS = 45000; // the sitemap limit is 50,000 URLs per file
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const day = (d) => new Date(d).toISOString().slice(0, 10);

const router = Router();

// Private areas and the account pages are kept out of search results.
router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send([
    'User-agent: *', 'Allow: /', 'Disallow: /dashboard', 'Disallow: /admin', 'Disallow: /login', 'Disallow: /register', 'Disallow: /forgot-password',
    'Disallow: /reset-password', 'Disallow: /verify-email', 'Disallow: /api/', '', `Sitemap: ${env.siteUrl}/sitemap.xml`, '',
  ].join('\n'));
});

// Only published listings and listed agents appear. Addresses are the readable slugs, never private data.
router.get('/sitemap.xml', asyncHandler(async (_req, res) => {
  const [properties, agents] = await Promise.all([
    Property.find({ status: 'published' }).select('slug updatedAt').sort({ updatedAt: -1 }).limit(MAX_URLS).lean(),
    User.find({ role: 'agent', isActive: true, 'agentProfile.isListed': true }).select('updatedAt').limit(5000).lean(),
  ]);
  const url = (path, lastmod, freq) => `<url><loc>${xml(env.siteUrl + path)}</loc>${lastmod ? `<lastmod>${day(lastmod)}</lastmod>` : ''}${freq ? `<changefreq>${freq}</changefreq>` : ''}</url>`;
  const body = [
    ...STATIC_PAGES.map((p) => url(p, null, p === '/' || p === '/properties' ? 'daily' : 'monthly')),
    ...properties.map((p) => url(`/properties/${encodeURIComponent(p.slug)}`, p.updatedAt, 'weekly')),
    ...agents.map((a) => url(`/agents/${a._id}`, a.updatedAt, 'weekly')),
  ].join('');
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
}));

export default router;
