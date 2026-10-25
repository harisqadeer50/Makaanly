import { useEffect } from 'react';
import { safeJson, siteUrl } from '../utils/seo';

const DEFAULT_TITLE = "Makaanly | Find a Place You'll Love to Call Home";
const DEFAULT_DESCRIPTION = 'Explore houses, apartments, plots and commercial properties for sale or rent in Pakistan. Discover your next home with Makaanly.';

// Creates the tag if it is missing, or updates it; the returned function puts it back as it was.
function upsert(selector, create, valueAttr, value) {
  let el = document.head.querySelector(selector);
  const created = !el;
  if (created) { el = create(); document.head.appendChild(el); }
  const previous = el.getAttribute(valueAttr);
  el.setAttribute(valueAttr, value);
  return () => { if (created) el.remove(); else if (previous !== null) el.setAttribute(valueAttr, previous); };
}
const meta = (attr, key, value) => upsert(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; }, 'content', value);

// Sets the page title, description, canonical link, social-sharing tags and structured data, and restores everything when the page is left.
// Search engines that run JavaScript, such as Google, read these. Social-media link previews do not; see docs/DEPLOYMENT.md.
export function useSeo({ title, description = DEFAULT_DESCRIPTION, canonical, image, type = 'website', noindex = false, jsonLd } = {}) {
  const key = JSON.stringify([title, description, canonical, image, type, noindex, jsonLd]);
  useEffect(() => {
    const site = siteUrl();
    const fullTitle = title ? (title.includes('Makaanly') ? title : `${title} | Makaanly`) : DEFAULT_TITLE;
    const url = canonical || `${site}${window.location.pathname}`;
    const undo = [];
    const previousTitle = document.title;
    document.title = fullTitle;
    undo.push(meta('name', 'description', description));
    undo.push(meta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow'));
    undo.push(upsert('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }, 'href', url));
    const tags = { 'og:title': fullTitle, 'og:description': description, 'og:type': type, 'og:url': url, 'og:site_name': 'Makaanly', 'og:image': image,
      'twitter:card': image ? 'summary_large_image' : 'summary', 'twitter:title': fullTitle, 'twitter:description': description, 'twitter:image': image };
    Object.entries(tags).forEach(([k, v]) => { if (v) undo.push(meta(k.startsWith('og:') ? 'property' : 'name', k, v)); });
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json'; script.dataset.seo = 'true'; script.textContent = safeJson(jsonLd);
      document.head.appendChild(script); undo.push(() => script.remove());
    }
    return () => { document.title = previousTitle; [...undo].reverse().forEach((u) => u()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
