// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ current: null }));
vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: () => auth.current, AuthProvider: ({ children }) => children }));
vi.mock('../src/services/admin.js', () => ({ categoriesApi: { list: vi.fn(async () => []) } }));
vi.mock('../src/services/auth.js', () => ({ authApi: { changePassword: vi.fn(), logoutAll: vi.fn() } }));
vi.mock('../src/services/properties.js', () => ({ propertiesApi: { list: vi.fn(), get: vi.fn(), similar: vi.fn(), locations: vi.fn() } }));
vi.mock('../src/services/marketplace.js', () => ({
  favoritesApi: { ids: vi.fn(async () => []), add: vi.fn(), remove: vi.fn() }, inquiriesApi: { create: vi.fn() }, appointmentsApi: { create: vi.fn() }, reportsApi: { create: vi.fn() },
  agentsApi: { list: vi.fn() }, usersApi: { setPreferences: vi.fn() }, dashboardApi: { summary: vi.fn() },
  notificationsApi: { list: vi.fn(), unreadCount: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));
const { authApi } = await import('../src/services/auth.js');
const { propertiesApi } = await import('../src/services/properties.js');
const api = await import('../src/services/marketplace.js');
const { ToastProvider } = await import('../src/components/common/Toast.jsx');
const { default: Navbar } = await import('../src/components/layout/Navbar.jsx');
const { default: DashboardLayout } = await import('../src/components/dashboard/DashboardLayout.jsx');
const { default: NotificationBell } = await import('../src/components/layout/NotificationBell.jsx');
const { default: Notifications } = await import('../src/pages/dashboard/Notifications.jsx');
const { default: Settings } = await import('../src/pages/dashboard/Settings.jsx');
const { default: Properties } = await import('../src/pages/Properties.jsx');
const { default: PropertyDetail } = await import('../src/pages/PropertyDetail.jsx');
const { default: Support } = await import('../src/pages/static/Support.jsx');
const { default: Privacy } = await import('../src/pages/static/Privacy.jsx');
const { default: Terms } = await import('../src/pages/static/Terms.jsx');
const { HowItWorks, FeaturedAgents, WhyChoose, Testimonials, Faq, ListCta } = await import('../src/components/home/HomeSections.jsx');
const { useSeo } = await import('../src/hooks/useSeo.js');
const seo = await import('../src/utils/seo.js');
const { FAQ } = await import('../src/content/faq.js');
const { site } = await import('../src/config/site.js');
const { slotTimes } = await import('../src/utils/datetime.js');
const { DEFAULT_FILTERS } = await import('../src/utils/searchParams.js');
const { default: PropertyFilters } = await import('../src/components/property/PropertyFilters.jsx');

const Where = () => { const l = useLocation(); return <output data-testid="url">{l.pathname}{l.search}</output>; };
const renderAt = (ui, url = '/', path = '*') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter initialEntries={[url]}><Routes><Route path={path} element={ui} /></Routes><Where /></MemoryRouter></ToastProvider></QueryClientProvider>);
};
const url = () => screen.getByTestId('url').textContent;
const asUser = (over = {}) => { auth.current = { status: 'authenticated', isAuthenticated: true, setUser: vi.fn(), user: { id: 'u1', name: 'Sam', role: 'buyer', isEmailVerified: true, notificationPrefs: { email: true }, ...over } }; return auth.current; };
const head = (sel) => document.head.querySelector(sel);
const prop = (over = {}) => ({ id: 'p1', slug: 'house-1', referenceId: 'GF-1', title: 'Spacious house in DHA', description: 'A bright home near the park with a lawn.', purpose: 'sale', propertyType: 'house', status: 'published', price: 15000000, currency: 'PKR',
  coveredArea: 5, areaUnit: 'marla', amenities: [], images: [{ id: 'i', url: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg' }], updatedAt: '2026-10-01T00:00:00Z', publishedAt: '2026-09-20T00:00:00Z',
  location: { city: 'Lahore', neighborhood: 'DHA', street: '12 Secret Lane', coordinates: null }, owner: { id: 'o1', name: 'Olivia', role: 'owner' }, ...over });

beforeEach(() => { asUser(); document.head.innerHTML = ''; });
afterEach(cleanup);

describe('search-engine helpers', () => {
  const S = 'https://makaanly.example';
  it('writes readable titles for searches', () => {
    expect(seo.searchTitle({ purpose: 'sale', city: 'Lahore', type: ['house'] })).toBe('Houses for sale in Lahore');
    expect(seo.searchTitle({ purpose: 'rent', city: 'Karachi', type: [] })).toBe('Properties for rent in Karachi');
    expect(seo.searchTitle({ type: ['commercial', 'office', 'shop'] })).toBe('Commercial properties');
    expect(seo.searchTitle({ type: ['house', 'plot'] })).toBe('Properties');
  });
  it('indexes only simple first-page searches, with a stable canonical address', () => {
    const f = { ...DEFAULT_FILTERS, purpose: 'sale', city: 'Lahore', type: ['house', 'apartment'] };
    expect(seo.searchSeo(f, 1, { site: S })).toEqual({ canonical: `${S}/properties?purpose=sale&city=Lahore&type=apartment%2Chouse`, noindex: false });
    expect(seo.searchSeo(f, 2, { site: S }).noindex).toBe(true);
    for (const extra of [{ q: 'villa' }, { minPrice: '5000000' }, { bedrooms: '3' }, { sort: 'price_asc' }, { amenities: ['gym'] }, { verified: true }]) expect(seo.searchSeo({ ...f, ...extra }, 1, { site: S }).noindex).toBe(true);
    expect(seo.searchSeo({ ...f, sort: 'price_asc', minPrice: '5' }, 1, { site: S }).canonical).toBe(seo.searchSeo(f, 1, { site: S }).canonical); // refinements never change the canonical
    expect(seo.searchSeo(DEFAULT_FILTERS, 1, { site: S })).toEqual({ canonical: `${S}/properties`, noindex: false });
  });
  it('describes a live listing for search engines without revealing the street address', () => {
    const s = seo.propertySeo(prop(), { site: S });
    expect(s.noindex).toBe(false); expect(s.canonical).toBe(`${S}/properties/house-1`); expect(s.title).toContain('Spacious house in DHA'); expect(s.title).toContain('DHA, Lahore');
    expect(s.description.length).toBeLessThanOrEqual(155); expect(s.image).toContain('w_1200,h_630');
    expect(s.jsonLd.map((n) => n['@type'])).toEqual(['RealEstateListing', 'BreadcrumbList']);
    expect(JSON.stringify(s)).not.toContain('Secret Lane');
    expect(s.jsonLd[0]).toMatchObject({ name: 'Spacious house in DHA', datePosted: '2026-09-20T00:00:00Z', about: { address: { addressLocality: 'Lahore', addressCountry: 'PK' } } });
    expect(s.jsonLd[1].itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
  });
  it('keeps sold, rented, paused and preview pages out of search results', () => {
    for (const status of ['sold', 'rented', 'paused', 'draft']) { const s = seo.propertySeo(prop({ status }), { site: S }); expect(s.noindex).toBe(true); expect(s.jsonLd).toBeUndefined(); }
    expect(seo.propertySeo(prop(), { preview: true, site: S }).noindex).toBe(true);
  });
  it('an agent page publishes only the contact details the agent chose to share', () => {
    const a = { id: 'a1', name: 'Aamir', agencyName: 'Prime Homes', bio: 'Ten years selling homes.', serviceAreas: ['DHA'], contactPhone: '0300 1112223', contactEmail: null, avatarUrl: null };
    const { jsonLd } = seo.agentSeo(a, { site: S });
    expect(jsonLd).toMatchObject({ '@type': 'RealEstateAgent', telephone: '0300 1112223', worksFor: { name: 'Prime Homes' }, areaServed: [{ name: 'DHA' }] });
    expect(jsonLd.email).toBeUndefined();
  });
  it('describes the site search for search engines', () => {
    expect(seo.websiteJsonLd(S).potentialAction).toMatchObject({ '@type': 'SearchAction', target: `${S}/properties?q={search_term_string}` });
  });
  it('structured data can never close its own script tag, whatever a listing says', () => {
    const evil = '</script><script>alert(1)</script> & <b>';
    const out = seo.safeJson({ name: evil });
    expect(out).not.toContain('<'); expect(out).not.toContain('>'); expect(JSON.parse(out).name).toBe(evil);
  });
  it('trims long text with an ellipsis', () => { expect(seo.trimText('word '.repeat(100), 50)).toHaveLength(50); expect(seo.trimText('word '.repeat(100), 50).endsWith('…')).toBe(true); expect(seo.trimText('short')).toBe('short'); });
});

describe('useSeo', () => {
  const Probe = (props) => { useSeo(props); return null; };
  it('sets the title, description, robots, canonical and sharing tags, and removes them on leaving', () => {
    const { unmount } = render(<Probe title="Houses for sale in Lahore" description="Browse houses." canonical="https://x.example/properties?city=Lahore" image="https://img.example/a.jpg" />);
    expect(document.title).toBe('Houses for sale in Lahore | Makaanly');
    expect(head('meta[name="description"]').content).toBe('Browse houses.'); expect(head('meta[name="robots"]').content).toBe('index, follow');
    expect(head('link[rel="canonical"]').href).toBe('https://x.example/properties?city=Lahore');
    expect(head('meta[property="og:title"]').content).toBe('Houses for sale in Lahore | Makaanly'); expect(head('meta[property="og:image"]').content).toBe('https://img.example/a.jpg');
    expect(head('meta[name="twitter:card"]').content).toBe('summary_large_image');
    unmount();
    expect(head('meta[name="description"]')).toBeNull(); expect(head('link[rel="canonical"]')).toBeNull(); expect(head('meta[property="og:title"]')).toBeNull();
  });
  it('restores a tag that already existed instead of deleting it', () => {
    document.head.innerHTML = '<meta name="description" content="Default text">';
    const { unmount } = render(<Probe title="Page" description="Special" />);
    expect(head('meta[name="description"]').content).toBe('Special');
    unmount();
    expect(head('meta[name="description"]').content).toBe('Default text');
  });
  it('marks pages as noindex when asked, and uses a plain card without an image', () => {
    render(<Probe title="Private" noindex />);
    expect(head('meta[name="robots"]').content).toBe('noindex, follow'); expect(head('meta[name="twitter:card"]').content).toBe('summary'); expect(head('meta[property="og:image"]')).toBeNull();
  });
  it('adds structured data safely, and takes it away again', () => {
    const { unmount } = render(<Probe title="P" jsonLd={{ '@type': 'Thing', name: '</script><img src=x onerror=alert(1)>' }} />);
    const script = head('script[type="application/ld+json"]');
    expect(script.textContent).not.toContain('</script>'); expect(JSON.parse(script.textContent).name).toContain('onerror');
    expect(document.head.querySelectorAll('script').length).toBe(1);
    unmount(); expect(head('script[type="application/ld+json"]')).toBeNull();
  });
  it('updates when the page content changes, without leaving stale tags', () => {
    const { rerender } = render(<Probe title="One" description="First" />);
    rerender(<Probe title="Two" description="Second" />);
    expect(document.title).toBe('Two | Makaanly'); expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1); expect(head('meta[name="description"]').content).toBe('Second');
  });
});

describe('search-engine tags on real pages', () => {
  beforeEach(() => {
    propertiesApi.list.mockReset().mockResolvedValue({ properties: [prop()], meta: { total: 1, totalPages: 1, page: 1 } });
    propertiesApi.locations.mockReset().mockResolvedValue({ cities: [], neighborhoods: [] });
    propertiesApi.similar.mockReset().mockResolvedValue({ properties: [] });
  });
  it('a simple search is indexable with a clean canonical address and a descriptive title', async () => {
    renderAt(<Properties />, '/properties?purpose=sale&city=Lahore&type=house&sort=price_asc&view=list');
    await screen.findByText('Spacious house in DHA');
    expect(document.title).toBe('Houses for sale in Lahore | Makaanly');
    expect(head('link[rel="canonical"]').href).toBe(`${seo.siteUrl()}/properties?purpose=sale&city=Lahore&type=house`);
    expect(head('meta[name="robots"]').content).toBe('noindex, follow'); // the price sort makes this a refinement
  });
  it('an unrefined search is indexable', async () => {
    renderAt(<Properties />, '/properties?purpose=rent&city=Karachi');
    await screen.findByText('Spacious house in DHA');
    expect(head('meta[name="robots"]').content).toBe('index, follow'); expect(document.title).toBe('Properties for rent in Karachi | Makaanly');
  });
  it('a live listing carries structured data; a sold one is kept out of search results', async () => {
    propertiesApi.get.mockResolvedValue({ property: prop(), viewer: { canEdit: false } });
    renderAt(<PropertyDetail />, '/properties/house-1', '/properties/:slug');
    await screen.findByRole('heading', { name: 'Spacious house in DHA' });
    expect(head('meta[name="robots"]').content).toBe('index, follow'); const nodes = JSON.parse(head('script[type="application/ld+json"]').textContent);
    expect(nodes.map((n) => n['@type'])).toEqual(['RealEstateListing', 'BreadcrumbList']); // one script holding a list of two structured-data nodes
    cleanup();
    propertiesApi.get.mockResolvedValue({ property: prop({ status: 'sold' }), viewer: { canEdit: false } });
    renderAt(<PropertyDetail />, '/properties/house-1', '/properties/:slug');
    await screen.findByText(/no longer available/);
    expect(head('meta[name="robots"]').content).toBe('noindex, follow'); expect(head('script[type="application/ld+json"]')).toBeNull();
  });
});

describe('notification bell', () => {
  it('shows the unread count, in text for screen readers too', async () => {
    api.notificationsApi.unreadCount.mockResolvedValue({ count: 3 });
    renderAt(<NotificationBell />);
    const link = await screen.findByRole('link', { name: 'Notifications, 3 unread' });
    expect(link.getAttribute('href')).toBe('/dashboard/notifications'); expect(link.textContent).toBe('3');
  });
  it('shows no badge when there is nothing new, and caps large numbers', async () => {
    api.notificationsApi.unreadCount.mockResolvedValue({ count: 0 });
    renderAt(<NotificationBell />);
    expect(await screen.findByRole('link', { name: 'Notifications' })).toBeTruthy(); expect(screen.getByRole('link', { name: 'Notifications' }).textContent).toBe('');
    cleanup(); api.notificationsApi.unreadCount.mockResolvedValue({ count: 250 });
    renderAt(<NotificationBell />);
    expect((await screen.findByRole('link', { name: /250 unread/ })).textContent).toBe('99+');
  });
  it('only signed-in people get a bell, and it does not ask the server when signed out', async () => {
    api.notificationsApi.unreadCount.mockClear();
    auth.current = { status: 'guest', isAuthenticated: false, user: null };
    renderAt(<Navbar />);
    expect(screen.queryByRole('link', { name: /Notifications/ })).toBeNull();
    await new Promise((r) => setTimeout(r, 30));
    expect(api.notificationsApi.unreadCount).not.toHaveBeenCalled();
    cleanup(); asUser(); api.notificationsApi.unreadCount.mockResolvedValue({ count: 1 });
    renderAt(<Navbar />);
    expect((await screen.findAllByRole('link', { name: 'Notifications, 1 unread' })).length).toBeGreaterThan(0);
  });
  it('the dashboard menu shows the same count', async () => {
    api.dashboardApi.summary.mockResolvedValue({ newInquiries: 0, pendingViewings: 0 }); api.notificationsApi.unreadCount.mockResolvedValue({ count: 4 });
    renderAt(<Routes><Route path="/dashboard" element={<DashboardLayout />}><Route index element={<p>x</p>} /></Route></Routes>, '/dashboard');
    const link = await screen.findByRole('link', { name: /Notifications/ });
    await waitFor(() => expect(link.textContent).toContain('4 new'));
  });
});

describe('notifications page', () => {
  const row = (over = {}) => ({ id: 'n1', type: 'inquiry.new', title: 'New inquiry about House', body: 'Is it still available?', link: '/dashboard/inquiries/i1', read: false, createdAt: new Date().toISOString(), ...over });
  const load = (items, unread = items.filter((n) => !n.read).length) => api.notificationsApi.list.mockResolvedValue({ notifications: items, meta: { total: items.length, totalPages: 1, page: 1, unread } });
  beforeEach(() => { api.notificationsApi.markRead.mockReset().mockResolvedValue({}); api.notificationsApi.markAllRead.mockReset().mockResolvedValue({ updated: 1 }); api.notificationsApi.unreadCount.mockResolvedValue({ count: 1 }); });

  it('shows what happened, with unread ones marked in text as well as colour', async () => {
    load([row(), row({ id: 'n2', title: 'Your listing is live', body: '', link: null, read: true, type: 'listing.approved' })]);
    renderAt(<Notifications />);
    expect(await screen.findByText('New inquiry about House')).toBeTruthy();
    expect(screen.getByText('Unread:')).toBeTruthy(); expect(screen.getByText('1 unread')).toBeTruthy(); expect(screen.getByText('Your listing is live')).toBeTruthy();
  });
  it('opening one marks it read and goes to the conversation', async () => {
    load([row()]);
    const user = userEvent.setup();
    renderAt(<Routes><Route path="/dashboard/notifications" element={<Notifications />} /><Route path="*" element={<p>elsewhere</p>} /></Routes>, '/dashboard/notifications');
    await user.click(await screen.findByRole('link', { name: /New inquiry about House/ }));
    expect(api.notificationsApi.markRead).toHaveBeenCalledWith('n1'); expect(url()).toBe('/dashboard/inquiries/i1');
  });
  it('one without a link can still be marked read, and a read one is not sent again', async () => {
    load([row({ link: null }), row({ id: 'n3', read: true, title: 'Old news', link: null })]);
    const user = userEvent.setup();
    renderAt(<Notifications />);
    await user.click(await screen.findByRole('button', { name: /New inquiry about House/ }));
    expect(api.notificationsApi.markRead).toHaveBeenCalledWith('n1');
    await user.click(screen.getByRole('button', { name: /Old news/ }));
    expect(api.notificationsApi.markRead).toHaveBeenCalledTimes(1);
  });
  it('marks everything read in one go, and the button is off when nothing is unread', async () => {
    load([row()]);
    const user = userEvent.setup();
    renderAt(<Notifications />);
    await user.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    expect(api.notificationsApi.markAllRead).toHaveBeenCalled(); expect(await screen.findByText('All notifications marked as read.')).toBeTruthy();
    cleanup(); load([row({ read: true })], 0);
    renderAt(<Notifications />);
    await screen.findByText('New inquiry about House');
    expect(screen.getByRole('button', { name: 'Mark all as read' }).disabled).toBe(true); expect(screen.getByText('You are all caught up')).toBeTruthy();
  });
  it('filters to unread through the URL, and says so when there are none', async () => {
    load([row()]);
    const user = userEvent.setup();
    renderAt(<Notifications />);
    await screen.findByText('New inquiry about House');
    await user.click(screen.getByRole('checkbox', { name: 'Unread only' }));
    expect(url()).toBe('/?unread=true');
    await waitFor(() => expect(api.notificationsApi.list).toHaveBeenLastCalledWith({ page: 1, limit: 20, unread: true }));
    cleanup(); load([], 0);
    renderAt(<Notifications />, '/?unread=true');
    expect(await screen.findByText('No unread notifications')).toBeTruthy();
  });
  it('shows an error with a retry', async () => {
    api.notificationsApi.list.mockRejectedValueOnce({ message: 'Cannot reach the server.' }); load([row()]);
    const user = userEvent.setup();
    renderAt(<Notifications />);
    expect(await screen.findByText('Cannot reach the server.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('New inquiry about House')).toBeTruthy();
  });
});

describe('settings', () => {
  beforeEach(() => { authApi.changePassword.mockReset().mockResolvedValue({}); authApi.logoutAll.mockReset().mockResolvedValue({}); api.usersApi.setPreferences.mockReset(); });
  const fill = async (user, current = 'OldPass123', next = 'NewPass456', confirm = next) => {
    await user.type(screen.getByLabelText('Current password'), current); await user.type(screen.getByLabelText('New password'), next); await user.type(screen.getByLabelText('Confirm new password'), confirm);
  };

  it('checks the new password before sending anything', async () => {
    const user = userEvent.setup();
    renderAt(<Settings />);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByText('Enter your current password')).toBeTruthy();
    await fill(user, 'OldPass123', 'short', 'different');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Password must be at least 8 characters')).toBeTruthy(); expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });
  it('will not accept the same password again', async () => {
    const user = userEvent.setup();
    renderAt(<Settings />);
    await fill(user, 'SamePass123', 'SamePass123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Choose a password that is different from your current one')).toBeTruthy(); expect(authApi.changePassword).not.toHaveBeenCalled();
  });
  it('changes the password, confirms, and clears the form', async () => {
    const user = userEvent.setup();
    renderAt(<Settings />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(authApi.changePassword).toHaveBeenCalledWith({ currentPassword: 'OldPass123', password: 'NewPass456', confirmPassword: 'NewPass456' }));
    expect(await screen.findByText(/Password changed/)).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Current password').value).toBe(''));
  });
  it('shows a wrong current password on that field', async () => {
    authApi.changePassword.mockRejectedValue({ message: 'Please check', errors: [{ field: 'currentPassword', message: 'Your current password is incorrect' }] });
    const user = userEvent.setup();
    renderAt(<Settings />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your current password is incorrect')).toBeTruthy();
  });
  it('turns optional emails on and off, and says what is always sent', async () => {
    api.usersApi.setPreferences.mockResolvedValue({ user: { notificationPrefs: { email: false } } });
    const user = userEvent.setup();
    const a = asUser();
    renderAt(<Settings />);
    const box = screen.getByRole('checkbox', { name: /Email me about new messages/ });
    expect(box.checked).toBe(true); expect(screen.getByText(/always email you about security/)).toBeTruthy();
    await user.click(box);
    expect(api.usersApi.setPreferences).toHaveBeenCalledWith({ emailNotifications: false });
    await waitFor(() => expect(a.setUser).toHaveBeenCalled()); expect(await screen.findByText('Email notifications are off.')).toBeTruthy();
  });
  it('reads the preference from the account, treating older accounts as "on"', () => {
    asUser({ notificationPrefs: { email: false } }); renderAt(<Settings />);
    expect(screen.getByRole('checkbox', { name: /Email me about new messages/ }).checked).toBe(false);
    cleanup(); asUser({ notificationPrefs: undefined }); renderAt(<Settings />);
    expect(screen.getByRole('checkbox', { name: /Email me about new messages/ }).checked).toBe(true);
  });
  it('explains if saving the preference fails', async () => {
    api.usersApi.setPreferences.mockRejectedValue({ message: 'Cannot reach the server.' });
    const user = userEvent.setup();
    renderAt(<Settings />);
    await user.click(screen.getByRole('checkbox', { name: /Email me about new messages/ }));
    expect(await screen.findByText('Cannot reach the server.')).toBeTruthy();
  });
  it('signing out everywhere asks first, then signs out and goes to the login page', async () => {
    const a = asUser(); const user = userEvent.setup();
    renderAt(<Routes><Route path="/dashboard/settings" element={<Settings />} /><Route path="/login" element={<p>login page</p>} /></Routes>, '/dashboard/settings');
    await user.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    expect(authApi.logoutAll).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sign out everywhere' }));
    await waitFor(() => expect(authApi.logoutAll).toHaveBeenCalled()); expect(a.setUser).toHaveBeenCalledWith(null);
    await waitFor(() => expect(url()).toBe('/login'));
  });
});

describe('home page sections', () => {
  it('explains how it works in three numbered steps', () => {
    renderAt(<HowItWorks />);
    const steps = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(steps).toHaveLength(3); expect(steps[0].textContent).toContain('Step 1'); expect(steps[2].textContent).toContain('Arrange a viewing');
  });
  it('shows real agents when there are some, and nothing at all when there are none', async () => {
    api.agentsApi.list.mockResolvedValue({ agents: [{ id: 'a1', name: 'Aamir Agent', isVerified: true, agencyName: 'Prime Homes', serviceAreas: ['DHA'], specialties: [], listingCount: 2 }], meta: {} });
    renderAt(<FeaturedAgents />);
    expect(await screen.findByRole('heading', { name: 'Meet our agents' })).toBeTruthy(); expect(screen.getByRole('link', { name: /Aamir Agent/ }).getAttribute('href')).toBe('/agents/a1');
    cleanup(); api.agentsApi.list.mockResolvedValue({ agents: [], meta: {} });
    const { container } = renderAt(<FeaturedAgents />);
    await waitFor(() => expect(api.agentsApi.list).toHaveBeenCalledTimes(2)); await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector('section')).toBeNull();
  });
  it('is honest about what makes Makaanly different', () => {
    renderAt(<WhyChoose />);
    expect(screen.getByText(/Marla, kanal, square feet and square yards/)).toBeTruthy(); expect(screen.getByText(/only once they pass/)).toBeTruthy();
  });
  it('labels sample testimonials as demonstration content, and can hide them', () => {
    renderAt(<Testimonials />);
    expect(screen.getByText(/Sample testimonials \(demonstration content\)/)).toBeTruthy(); expect(screen.getAllByText(/^Sample (buyer|agent|owner)/)).toHaveLength(3);
    cleanup(); site.showDemoTestimonials = false;
    renderAt(<Testimonials />);
    expect(screen.queryByText(/Sample testimonials/)).toBeNull(); site.showDemoTestimonials = true;
  });
  it('answers questions with expandable details, and links to the full support page', () => {
    renderAt(<Faq />);
    expect(document.querySelectorAll('details')).toHaveLength(6); expect(screen.getByRole('link', { name: 'More help' }).getAttribute('href')).toBe('/support');
  });
  it('invites owners to list, and sends guests through log in', () => {
    renderAt(<ListCta />);
    expect(screen.getByRole('link', { name: 'List your property' }).getAttribute('href')).toBe('/dashboard/properties/new'); expect(screen.getByRole('link', { name: 'Find an agent' }).getAttribute('href')).toBe('/agents');
  });
});

describe('support and legal pages', () => {
  it('support shows how to get in touch and every common question', () => {
    renderAt(<Support />);
    expect(screen.getByRole('link', { name: new RegExp(site.supportEmail) }).getAttribute('href')).toBe(`mailto:${site.supportEmail}`);
    expect(document.querySelectorAll('details')).toHaveLength(FAQ.length);
  });
  it('the FAQ matches how the product actually works', () => {
    const text = (q) => FAQ.find((f) => f.q.includes(q)).a;
    const t = slotTimes(30);
    expect(text('When can I view')).toContain(`${Number(t[0].slice(0, 2))}:00`); expect(text('When can I view')).toContain('20:00'); expect(text('When can I view')).toContain('60 days'); expect(text('When can I view')).toContain('hour');
    expect(text('area units')).toContain('272.25'); expect(text('Which area units')).toMatch(/marla.*kanal.*square feet.*square yards/i);
    expect(text('delete my account')).toContain(site.supportEmail); // account deletion is by email, and the FAQ says so
  });
  it('the privacy policy is specific about documents, cookies and deletion, and the terms point to safety', () => {
    renderAt(<Privacy />);
    expect(screen.getByText(/deleted as soon as we make a decision/)).toBeTruthy(); expect(screen.getByText(/no cookie banner/)).toBeTruthy(); expect(screen.getByText(/do not sell your personal information/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: site.supportEmail }).length).toBeGreaterThan(0); expect(screen.getByText(`Last updated ${site.legalUpdated}`)).toBeTruthy();
    cleanup(); renderAt(<Terms />);
    expect(screen.getByRole('link', { name: 'safety tips' }).getAttribute('href')).toBe('/safety');
  });
});

describe('filter panel keeps focus while you type (regression)', () => {
  it('a typed price keeps every character and the field stays focused', async () => {
    propertiesApi.locations.mockResolvedValue({ cities: [], neighborhoods: [] });
    const onChange = vi.fn(); const user = userEvent.setup();
    renderAt(<PropertyFilters value={DEFAULT_FILTERS} onChange={onChange} />);
    const [min] = screen.getAllByLabelText('Min');
    await user.type(min, '5000000');
    expect(min.value).toBe('5000000'); expect(document.activeElement).toBe(min);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minPrice: '5000000' })), { timeout: 2000 });
    expect(onChange).toHaveBeenCalledTimes(1); // one update after the pause, not one per keystroke
  });
});
