// @vitest-environment jsdom
// Automated accessibility audit (axe-core) of whole pages, inside the real site layout. It catches missing labels, names, roles,
// landmarks and similar problems. It cannot judge colour contrast (jsdom has no layout); tests/contrast.test.js covers that.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axe from 'axe-core';

const auth = vi.hoisted(() => ({ current: null }));
vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: () => auth.current, AuthProvider: ({ children }) => children }));
const empty = { properties: [], meta: { total: 0, totalPages: 1, page: 1 } };
vi.mock('../src/services/health.js', () => ({ getHealth: vi.fn(async () => ({ status: 'ok', db: 'connected' })) }));
vi.mock('../src/services/properties.js', () => ({ propertiesApi: { list: vi.fn(), get: vi.fn(), similar: vi.fn(), locations: vi.fn(), mine: vi.fn(), getManaged: vi.fn(), setStatus: vi.fn(), remove: vi.fn() } }));
vi.mock('../src/services/marketplace.js', () => ({
  favoritesApi: { ids: vi.fn(async () => []), list: vi.fn(), add: vi.fn(), remove: vi.fn() }, inquiriesApi: { create: vi.fn(), sent: vi.fn(), received: vi.fn(), get: vi.fn() },
  appointmentsApi: { mine: vi.fn(), received: vi.fn(), create: vi.fn() }, reportsApi: { create: vi.fn() }, agentsApi: { list: vi.fn(), get: vi.fn(), saveProfile: vi.fn() },
  usersApi: { update: vi.fn(), setPreferences: vi.fn(), uploadAvatar: vi.fn(), removeAvatar: vi.fn() }, dashboardApi: { summary: vi.fn() },
  notificationsApi: { list: vi.fn(), unreadCount: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));
vi.mock('../src/services/auth.js', () => ({ authApi: { changePassword: vi.fn(), logoutAll: vi.fn(), login: vi.fn(), register: vi.fn(), forgotPassword: vi.fn(), me: vi.fn() } }));
vi.mock('../src/services/admin.js', () => ({
  adminApi: { dashboard: vi.fn(), users: vi.fn(), properties: vi.fn(), pending: vi.fn(), reports: vi.fn(), verifications: vi.fn(), categories: vi.fn(), auditLogs: vi.fn() },
  verificationApi: { me: vi.fn() }, categoriesApi: { list: vi.fn(async () => []) },
}));
const { propertiesApi } = await import('../src/services/properties.js');
const api = await import('../src/services/marketplace.js');
const { adminApi, verificationApi } = await import('../src/services/admin.js');
const { ToastProvider } = await import('../src/components/common/Toast.jsx');
const { default: MainLayout } = await import('../src/components/layout/MainLayout.jsx');
const { default: DashboardLayout } = await import('../src/components/dashboard/DashboardLayout.jsx');
const { default: AdminLayout } = await import('../src/components/admin/AdminLayout.jsx');
const P = {
  Home: (await import('../src/pages/Home.jsx')).default, Properties: (await import('../src/pages/Properties.jsx')).default, Detail: (await import('../src/pages/PropertyDetail.jsx')).default,
  Login: (await import('../src/pages/Login.jsx')).default, Register: (await import('../src/pages/Register.jsx')).default, Forgot: (await import('../src/pages/ForgotPassword.jsx')).default,
  Agents: (await import('../src/pages/Agents.jsx')).default, AgentProfile: (await import('../src/pages/AgentProfile.jsx')).default, Support: (await import('../src/pages/static/Support.jsx')).default,
  Privacy: (await import('../src/pages/static/Privacy.jsx')).default, Terms: (await import('../src/pages/static/Terms.jsx')).default, Safety: (await import('../src/pages/static/Safety.jsx')).default,
  NotFound: (await import('../src/pages/NotFound.jsx')).default, Dashboard: (await import('../src/pages/Dashboard.jsx')).default, Notifications: (await import('../src/pages/dashboard/Notifications.jsx')).default,
  Settings: (await import('../src/pages/dashboard/Settings.jsx')).default, Profile: (await import('../src/pages/dashboard/Profile.jsx')).default, Inquiries: (await import('../src/pages/dashboard/Inquiries.jsx')).default,
  Appointments: (await import('../src/pages/dashboard/Appointments.jsx')).default, Favorites: (await import('../src/pages/dashboard/Favorites.jsx')).default, MyProperties: (await import('../src/pages/dashboard/MyProperties.jsx')).default,
  Verification: (await import('../src/pages/dashboard/Verification.jsx')).default, AddProperty: (await import('../src/pages/dashboard/AddProperty.jsx')).default,
  AOverview: (await import('../src/pages/admin/Overview.jsx')).default, AModeration: (await import('../src/pages/admin/Moderation.jsx')).default, AUsers: (await import('../src/pages/admin/Users.jsx')).default,
  AListings: (await import('../src/pages/admin/Listings.jsx')).default, AReports: (await import('../src/pages/admin/Reports.jsx')).default, AVerifications: (await import('../src/pages/admin/Verifications.jsx')).default,
  ACategories: (await import('../src/pages/admin/Categories.jsx')).default, AAudit: (await import('../src/pages/admin/AuditLog.jsx')).default,
};
const ViewingModal = (await import('../src/components/marketplace/ViewingModal.jsx')).default;
const ReportModal = (await import('../src/components/marketplace/ReportModal.jsx')).default;

const prop = (n = 1, over = {}) => ({ id: `p${n}`, slug: `house-${n}`, referenceId: `GF-${n}`, title: `Spacious house number ${n}`, description: 'A bright home near the park.', purpose: 'sale', propertyType: 'house', status: 'published', price: 15000000, currency: 'PKR',
  coveredArea: 5, areaUnit: 'marla', bedrooms: 3, bathrooms: 2, amenities: ['parking'], images: [], updatedAt: '2026-10-01T00:00:00Z', publishedAt: '2026-09-20T00:00:00Z', location: { city: 'Lahore', neighborhood: 'DHA', coordinates: null }, owner: { id: 'o1', name: 'Olivia Owner', role: 'owner', isVerified: true }, ...over });
const list = (items) => ({ properties: items, meta: { total: items.length, totalPages: 1, page: 1, unread: 1 } });
const user = (role = 'buyer') => ({ id: 'u1', name: 'Sam Person', email: 's@x.com', role, isEmailVerified: true, notificationPrefs: { email: true }, agentProfile: {} });
const asGuest = () => { auth.current = { status: 'guest', isAuthenticated: false, user: null }; };
const asUser = (role) => { auth.current = { status: 'authenticated', isAuthenticated: true, user: user(role), setUser: vi.fn(), refreshUser: vi.fn(async () => {}), logout: vi.fn() }; };

async function audit(container = document.body, extra = {}) {
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, ...extra } });
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.html.slice(0, 140)).join('\n   ')}`);
}
function open(Page, { url = '/x', layout = 'main', path = '/x' } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const child = <Route path={path} element={<Page />} />;
  const tree = layout === 'dashboard' ? <Route path="/dashboard" element={<DashboardLayout />}>{child}</Route> : layout === 'admin' ? <Route path="/admin" element={<AdminLayout />}>{child}</Route> : child;
  return render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter initialEntries={[url]}><Routes><Route element={<MainLayout />}>{tree}</Route></Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
}

beforeEach(() => {
  asGuest();
  propertiesApi.list.mockReset().mockResolvedValue(list([prop(1), prop(2, { purpose: 'rent', rentalPeriod: 'monthly', price: 90000 })]));
  propertiesApi.locations.mockReset().mockResolvedValue({ cities: [{ name: 'Lahore', count: 2 }, { name: 'Karachi', count: 0 }], neighborhoods: [{ name: 'DHA', count: 2 }] });
  propertiesApi.get.mockReset().mockResolvedValue({ property: prop(1), viewer: { canEdit: false } }); propertiesApi.similar.mockReset().mockResolvedValue({ properties: [prop(2)] });
  propertiesApi.mine.mockReset().mockResolvedValue({ ...list([{ ...prop(1), status: 'draft', stats: { views: 3, favorites: 1, inquiries: 0 } }]) });
  api.agentsApi.list.mockReset().mockResolvedValue({ agents: [{ id: 'a1', name: 'Aamir Agent', avatarUrl: null, isVerified: true, agencyName: 'Prime Homes', serviceAreas: ['DHA'], specialties: ['house'], listingCount: 2 }], meta: { total: 1, totalPages: 1, page: 1 } });
  api.agentsApi.get.mockReset().mockResolvedValue({ agent: { id: 'a1', name: 'Aamir Agent', avatarUrl: null, isVerified: true, agencyName: 'Prime Homes', bio: 'Ten years selling homes in Lahore.', serviceAreas: ['DHA'], specialties: ['house'], contactPhone: '0300 1112223', contactEmail: null, listingCount: 2, memberSince: 2024 } });
  api.dashboardApi.summary.mockReset().mockResolvedValue({ favorites: 2, newInquiries: 1, pendingViewings: 1, upcomingViewings: 0, listings: { total: 3, published: 1, pending: 1, drafts: 1 } });
  api.notificationsApi.unreadCount.mockReset().mockResolvedValue({ count: 2 });
  api.notificationsApi.list.mockReset().mockResolvedValue({ notifications: [{ id: 'n1', type: 'inquiry.new', title: 'New inquiry about House', body: 'Is it available?', link: '/dashboard/inquiries/i1', read: false, createdAt: new Date().toISOString() }, { id: 'n2', type: 'listing.approved', title: 'Your listing is live', body: '', link: null, read: true, createdAt: new Date().toISOString() }], meta: { total: 2, totalPages: 1, page: 1, unread: 1 } });
  api.inquiriesApi.received.mockReset().mockResolvedValue({ inquiries: [{ id: 'i1', status: 'new', counterpart: { name: 'Bilal Buyer' }, property: { title: 'House', slug: 'h' }, message: 'Hello', replies: [], lastActivityAt: new Date().toISOString() }], meta: { total: 1, totalPages: 1 } });
  api.appointmentsApi.received.mockReset().mockResolvedValue({ appointments: [{ id: 'a1', status: 'requested', viewerRole: 'host', property: { title: 'House', slug: 'h' }, start: '2030-01-05T05:00:00Z', end: '2030-01-05T05:30:00Z', counterpart: { name: 'Rana', email: 'r@x.com' } }], meta: { total: 1, totalPages: 1 } });
  api.favoritesApi.list.mockReset().mockResolvedValue({ properties: [prop(1)] });
  verificationApi.me.mockReset().mockResolvedValue({ verificationStatus: 'none', request: null });
  adminApi.dashboard.mockReset().mockResolvedValue({ users: { total: 5, suspended: 1 }, listings: { total: 4, published: 2, pending: 1, rejected: 1 }, inquiries: { new: 2, last7Days: 3 }, reports: { open: 1, underReview: 0 }, verifications: { pending: 1 }, listingsByCity: [{ name: 'Lahore', count: 2 }],
    registrations: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, count: i % 3 })), inquiriesPerDay: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, count: 0 })), moderation: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, approved: i % 2, rejected: 0 })) });
  adminApi.pending.mockReset().mockResolvedValue({ properties: [{ ...prop(1), status: 'pending_review', imageCount: 1, images: [], openReports: 0, ownerInfo: { name: 'Olivia', email: 'o@x.com', role: 'owner' } }], meta: { total: 1, totalPages: 1 } });
  adminApi.users.mockReset().mockResolvedValue({ users: [{ id: 'u2', name: 'Olivia Owner', email: 'o@x.com', role: 'owner', isActive: true, isEmailVerified: true, verificationStatus: 'none', createdAt: '2026-08-01T00:00:00Z', listingCount: 2 }], meta: { total: 1, totalPages: 1 } });
  adminApi.properties.mockReset().mockResolvedValue({ properties: [{ ...prop(1), ownerInfo: { name: 'Olivia', email: 'o@x.com', role: 'owner' }, openReports: 0, isFeatured: false }], meta: { total: 1, totalPages: 1 } });
  adminApi.reports.mockReset().mockResolvedValue({ reports: [{ id: 'r1', reason: 'fake_listing', description: 'Fake', status: 'open', createdAt: new Date().toISOString(), reporter: { name: 'B', email: 'b@x.com' }, property: { id: 'p1', title: 'House', slug: 'h', status: 'published' } }], meta: { total: 1, totalPages: 1 } });
  adminApi.verifications.mockReset().mockResolvedValue({ verifications: [{ id: 'v1', status: 'pending', verificationType: 'agent', submittedAt: new Date().toISOString(), documentCount: 1, documents: [{ id: 'd1', format: 'jpg', originalName: 'id.jpg', bytes: 2048 }], user: { name: 'Aamir', email: 'a@x.com' } }], meta: { total: 1, totalPages: 1 } });
  adminApi.categories.mockReset().mockResolvedValue({ categories: ['house', 'apartment', 'plot', 'commercial', 'office', 'shop'].map((key, i) => ({ key, isActive: true, sortOrder: (i + 1) * 10 })) });
  adminApi.auditLogs.mockReset().mockResolvedValue({ logs: [{ id: 'l1', action: 'user.suspend', targetType: 'user', targetId: 'u', summary: 'Suspended Olivia', meta: { reason: 'Fake' }, createdAt: '2026-10-12T05:00:00Z', actor: { id: 'a', name: 'Ada' } }], meta: { total: 1, totalPages: 1 } });
});
afterEach(cleanup);

const GUEST_PAGES = [
  ['home', P.Home, '/', '/', 'Find a place'], ['search results', P.Properties, '/properties?city=Lahore', '/properties', 'Spacious house number 1'], ['search results (list view)', P.Properties, '/properties?view=list', '/properties', 'Spacious house number 1'],
  ['property detail (guest)', P.Detail, '/properties/house-1', '/properties/:slug', 'Spacious house number 1'], ['log in', P.Login, '/login', '/login', 'Welcome back'], ['register', P.Register, '/register', '/register', 'Create your account'],
  ['forgot password', P.Forgot, '/forgot-password', '/forgot-password', 'Reset your password'], ['agents', P.Agents, '/agents', '/agents', 'Aamir Agent'], ['agent profile', P.AgentProfile, '/agents/a1', '/agents/:id', 'Ten years selling'],
  ['support', P.Support, '/support', '/support', 'Common questions'], ['privacy', P.Privacy, '/privacy', '/privacy', 'What we collect'], ['terms', P.Terms, '/terms', '/terms', 'Your account'], ['safety', P.Safety, '/safety', '/safety', 'When you are buying or renting'], ['not found', P.NotFound, '/nope', '/nope', 'Page not found'],
];
describe('accessibility: public pages', () => {
  it.each(GUEST_PAGES)('%s has no detectable problems', async (_n, Page, url, path, ready) => {
    open(Page, { url, path });
    await screen.findAllByText(new RegExp(ready, 'i'));
    await new Promise((r) => setTimeout(r, 50));
    expect(await audit()).toEqual([]);
  });
  it('the search page with the mobile filter sheet open', async () => {
    open(P.Properties, { url: '/properties', path: '/properties' });
    await screen.findByText('Spacious house number 1');
    await userEvent.setup().click(screen.getByRole('button', { name: /Filters/ }));
    expect(await audit()).toEqual([]);
  });
});

const SIGNED_IN = [
  ['property detail (verified buyer)', P.Detail, '/properties/house-1', '/properties/:slug', 'main', 'buyer', 'Contact the lister'], ['dashboard overview', P.Dashboard, '/dashboard', '/dashboard', 'dashboard', 'owner', 'Saved properties'],
  ['notifications', P.Notifications, '/dashboard/notifications', '/dashboard/notifications', 'dashboard', 'buyer', 'New inquiry about House'], ['settings', P.Settings, '/dashboard/settings', '/dashboard/settings', 'dashboard', 'buyer', 'Change password'],
  ['profile (agent)', P.Profile, '/dashboard/profile', '/dashboard/profile', 'dashboard', 'agent', 'Public agent profile'], ['inquiries', P.Inquiries, '/dashboard/inquiries', '/dashboard/inquiries', 'dashboard', 'owner', 'Bilal Buyer'],
  ['viewings', P.Appointments, '/dashboard/appointments', '/dashboard/appointments', 'dashboard', 'owner', 'Rana'], ['saved properties', P.Favorites, '/dashboard/favorites', '/dashboard/favorites', 'dashboard', 'buyer', 'Spacious house number 1'],
  ['my properties', P.MyProperties, '/dashboard/properties', '/dashboard/properties', 'dashboard', 'owner', 'views'], ['verification form', P.Verification, '/dashboard/verification', '/dashboard/verification', 'dashboard', 'owner', 'Send for review'],
  ['add property (first step)', P.AddProperty, '/dashboard/properties/new', '/dashboard/properties/new', 'dashboard', 'owner', 'Add a property'],
];
describe('accessibility: signed-in pages', () => {
  it.each(SIGNED_IN)('%s has no detectable problems', async (_n, Page, url, path, layout, role, ready) => {
    asUser(role);
    open(Page, { url, path, layout });
    await screen.findAllByText(new RegExp(ready, 'i'));
    await new Promise((r) => setTimeout(r, 50));
    expect(await audit()).toEqual([]);
  });
  it('the viewing and report dialogs', async () => {
    asUser('buyer');
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter><ViewingModal open onClose={() => {}} property={prop(1)} /></MemoryRouter></ToastProvider></QueryClientProvider>);
    expect(await audit()).toEqual([]);
    cleanup();
    render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter><ReportModal open onClose={() => {}} property={prop(1)} /></MemoryRouter></ToastProvider></QueryClientProvider>);
    expect(await audit()).toEqual([]);
  });
});

const ADMIN = [
  ['overview', P.AOverview, '/admin', '/admin', 'Waiting for review'], ['moderation queue', P.AModeration, '/admin/moderation', '/admin/moderation', 'Spacious house number 1'], ['users', P.AUsers, '/admin/users', '/admin/users', 'Olivia Owner'],
  ['all listings', P.AListings, '/admin/properties', '/admin/properties', 'Spacious house number 1'], ['reports', P.AReports, '/admin/reports', '/admin/reports', 'Fake listing'], ['verifications', P.AVerifications, '/admin/verifications', '/admin/verifications', 'id.jpg'],
  ['property types', P.ACategories, '/admin/categories', '/admin/categories', 'House'], ['audit log', P.AAudit, '/admin/audit-log', '/admin/audit-log', 'Suspended Olivia'],
];
describe('accessibility: admin pages', () => {
  it.each(ADMIN)('%s has no detectable problems', async (_n, Page, url, path, ready) => {
    asUser('admin');
    open(Page, { url, path, layout: 'admin' });
    await screen.findAllByText(new RegExp(ready, 'i'));
    await new Promise((r) => setTimeout(r, 50));
    expect(await audit()).toEqual([]);
  });
});
