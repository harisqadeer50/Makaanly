// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ current: null }));
vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: () => auth.current, AuthProvider: ({ children }) => children }));
vi.mock('../src/services/admin.js', () => ({
  adminApi: { dashboard: vi.fn(), users: vi.fn(), setUserStatus: vi.fn(), properties: vi.fn(), pending: vi.fn(), moderate: vi.fn(), setFeatured: vi.fn(), reports: vi.fn(), updateReport: vi.fn(),
    verifications: vi.fn(), documentLink: vi.fn(), decideVerification: vi.fn(), auditLogs: vi.fn(), categories: vi.fn(), updateCategory: vi.fn() },
  verificationApi: { me: vi.fn(), submit: vi.fn() },
  categoriesApi: { list: vi.fn() },
}));
vi.mock('../src/services/properties.js', () => ({ propertiesApi: { setStatus: vi.fn(), remove: vi.fn(), update: vi.fn(), create: vi.fn(), uploadImage: vi.fn(), removeImage: vi.fn(), updateImages: vi.fn(), getManaged: vi.fn() } }));
const { adminApi, verificationApi, categoriesApi } = await import('../src/services/admin.js');
const { propertiesApi } = await import('../src/services/properties.js');
const { ToastProvider } = await import('../src/components/common/Toast.jsx');
const { default: AdminLayout } = await import('../src/components/admin/AdminLayout.jsx');
const { default: Overview } = await import('../src/pages/admin/Overview.jsx');
const { default: Moderation } = await import('../src/pages/admin/Moderation.jsx');
const { default: Listings } = await import('../src/pages/admin/Listings.jsx');
const { default: Users } = await import('../src/pages/admin/Users.jsx');
const { default: Reports } = await import('../src/pages/admin/Reports.jsx');
const { default: Verifications } = await import('../src/pages/admin/Verifications.jsx');
const { default: Categories } = await import('../src/pages/admin/Categories.jsx');
const { default: AuditLog } = await import('../src/pages/admin/AuditLog.jsx');
const { default: Verification } = await import('../src/pages/dashboard/Verification.jsx');
const { default: PropertyForm } = await import('../src/components/property/PropertyForm.jsx');
const { useActiveTypes } = await import('../src/hooks/useCategories.js');

const Where = () => { const l = useLocation(); return <output data-testid="url">{l.pathname}{l.search}</output>; };
const renderAt = (ui, url = '/', path = '*') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter initialEntries={[url]}><Routes><Route path={path} element={ui} /></Routes><Where /></MemoryRouter></ToastProvider></QueryClientProvider>);
};
const url = () => screen.getByTestId('url').textContent;
const meta = (n = 1) => ({ total: n, totalPages: 1, page: 1 });
const days = (n = 30, fn = () => 0) => Array.from({ length: n }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, count: fn(i) }));
const stats = (over = {}) => ({
  users: { total: 12, active: 11, suspended: 1, byRole: {} }, listings: { total: 9, published: 5, pending: 3, rejected: 1, byStatus: {} }, inquiries: { new: 4, last7Days: 6 }, reports: { open: 2, underReview: 1 }, verifications: { pending: 2 },
  listingsByCity: [{ name: 'Lahore', count: 4 }, { name: 'Karachi', count: 1 }], registrations: days(30, (i) => (i === 29 ? 5 : 0)), inquiriesPerDay: days(), moderation: days(30).map((d) => ({ date: d.date, approved: 0, rejected: 0 })), ...over,
});
const admin = { id: 'admin1', name: 'Ada Admin', role: 'admin', email: 'ada@x.com', isEmailVerified: true };

beforeEach(() => {
  auth.current = { status: 'authenticated', isAuthenticated: true, user: admin, refreshUser: vi.fn(async () => {}) };
  adminApi.dashboard.mockReset().mockResolvedValue(stats());
  categoriesApi.list.mockReset().mockResolvedValue(['house', 'apartment', 'plot', 'commercial', 'office', 'shop'].map((key, i) => ({ key, isActive: true, sortOrder: (i + 1) * 10 })));
});
afterEach(cleanup);

describe('overview', () => {
  it('shows live figures, with charts that have text equivalents', async () => {
    renderAt(<Overview />);
    expect(await screen.findByText('Waiting for review')).toBeTruthy();
    const card = (label) => screen.getByText(label).closest('a, div');
    expect(within(card('Waiting for review')).getByText('3')).toBeTruthy();
    expect(within(card('Users')).getByText('1 suspended')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'New registrations: 5 in the last 30 days' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Moderation activity: 0 approved, 0 rejected' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Published listings by city' })).toBeTruthy(); // hidden table for screen readers
    expect(screen.getAllByText('Lahore').length).toBeGreaterThan(0);
  });
  it('links to the page that handles each queue, and does not link figures that have no page', async () => {
    renderAt(<Overview />);
    expect((await screen.findByText('Waiting for review')).closest('a').getAttribute('href')).toBe('/admin/moderation');
    expect(screen.getByText('Reports to review').closest('a').getAttribute('href')).toBe('/admin/reports');
    expect(screen.getByText('New inquiries').closest('a')).toBeNull();
  });
  it('shows an error with a way to retry', async () => {
    adminApi.dashboard.mockRejectedValueOnce({ message: 'Cannot reach the server.' });
    const user = userEvent.setup();
    renderAt(<Overview />);
    expect(await screen.findByText('Cannot reach the server.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Waiting for review')).toBeTruthy();
  });
  it('the side navigation shows how many items wait', async () => {
    renderAt(<Routes><Route element={<AdminLayout />}><Route path="/admin" element={<p>child</p>} /></Route></Routes>, '/admin');
    const badge = async (name, n) => { const link = await screen.findByRole('link', { name }); await waitFor(() => expect(link.textContent).toContain(`${n} waiting`)); };
    await badge(/Moderation/, 3); await badge(/Reports/, 2); await badge(/Verifications/, 2);
  });
});

describe('moderation queue', () => {
  const item = (over = {}) => ({ id: 'p1', slug: 'house-1', referenceId: 'GF-1', title: 'Spacious house in DHA', description: 'A bright home.', purpose: 'sale', propertyType: 'house', price: 15000000, currency: 'PKR', coveredArea: 5, areaUnit: 'marla',
    location: { city: 'Lahore', neighborhood: 'DHA' }, images: [{ id: 'i', url: 'u' }], imageCount: 1, openReports: 0, updatedAt: new Date().toISOString(), ownerInfo: { id: 'o1', name: 'Olivia Owner', email: 'o@x.com', role: 'owner' }, ...over });
  const list = (items) => ({ properties: items, meta: meta(items.length) });

  it('approves in one click', async () => {
    adminApi.pending.mockResolvedValue(list([item()])); adminApi.moderate.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Moderation />);
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(adminApi.moderate).toHaveBeenCalledWith('p1', { decision: 'approve' });
    expect(await screen.findByText(/approved and published/)).toBeTruthy();
  });
  it('will not approve a listing with no photos', async () => {
    adminApi.pending.mockResolvedValue(list([item({ imageCount: 0, images: [] })]));
    renderAt(<Moderation />);
    expect((await screen.findByRole('button', { name: 'Approve' })).disabled).toBe(true);
    expect(screen.getByText(/no photos, so it cannot be approved/)).toBeTruthy();
  });
  it('rejecting needs a reason, and sends the internal note separately', async () => {
    adminApi.pending.mockResolvedValue(list([item()])); adminApi.moderate.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Moderation />);
    await user.click(await screen.findByRole('button', { name: /^Reject/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Reject listing' }));
    expect(dialog.getByText('Please write at least 5 characters.')).toBeTruthy();
    expect(adminApi.moderate).not.toHaveBeenCalled();
    await user.type(dialog.getByLabelText('Reason for the owner'), 'Photos are unclear');
    await user.type(dialog.getByLabelText(/Internal note/), 'Second strike');
    await user.click(dialog.getByRole('button', { name: 'Reject listing' }));
    expect(adminApi.moderate).toHaveBeenCalledWith('p1', { decision: 'reject', reason: 'Photos are unclear', note: 'Second strike' });
  });
  it('shows who submitted it, how many photos, and open reports; an empty queue says so', async () => {
    adminApi.pending.mockResolvedValue(list([item({ openReports: 2 })]));
    renderAt(<Moderation />);
    expect(await screen.findByText(/Olivia Owner/)).toBeTruthy(); expect(screen.getByText('2 open reports')).toBeTruthy(); expect(screen.getByText('1 photo')).toBeTruthy();
    cleanup(); adminApi.pending.mockResolvedValue(list([]));
    renderAt(<Moderation />);
    expect(await screen.findByText('The queue is empty')).toBeTruthy();
  });
  it('explains a refusal from the server (for example, someone else already decided)', async () => {
    adminApi.pending.mockResolvedValue(list([item()])); adminApi.moderate.mockRejectedValue({ message: 'Only listings waiting for review can be approved or rejected.' });
    const user = userEvent.setup();
    renderAt(<Moderation />);
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(/Only listings waiting for review/)).toBeTruthy();
  });
});

describe('all listings', () => {
  const row = (over = {}) => ({ id: 'p1', slug: 'house-1', referenceId: 'GF-1', title: 'Spacious house in DHA', status: 'published', isFeatured: false, purpose: 'sale', price: 15000000, currency: 'PKR', images: [], updatedAt: '2026-10-01T00:00:00Z',
    location: { city: 'Lahore', neighborhood: 'DHA' }, openReports: 0, ownerInfo: { id: 'o1', name: 'Olivia Owner', email: 'o@x.com', role: 'owner' }, ...over });
  const load = (items) => adminApi.properties.mockResolvedValue({ properties: items, meta: meta(items.length) });

  it('shows every listing with its owner, status, featured flag and open reports', async () => {
    load([row({ isFeatured: true, openReports: 2 }), row({ id: 'p2', slug: 'x', title: 'Draft flat', status: 'draft' })]);
    renderAt(<Listings />);
    expect(await screen.findByText('Spacious house in DHA')).toBeTruthy();
    const table = within(screen.getByRole('table', { name: 'Listings' }));
    expect(table.getAllByText('o@x.com')).toHaveLength(2); expect(table.getByText('Featured')).toBeTruthy(); expect(table.getByText('2 reports')).toBeTruthy(); expect(table.getByText('Draft')).toBeTruthy();
  });
  it('features a published listing, and offers each status only the actions that apply', async () => {
    load([row(), row({ id: 'p2', title: 'Draft flat', status: 'draft' }), row({ id: 'p3', title: 'Waiting flat', status: 'pending_review' }), row({ id: 'p4', title: 'Old flat', status: 'archived' })]);
    adminApi.setFeatured.mockResolvedValue({ property: { isFeatured: true } });
    const user = userEvent.setup();
    renderAt(<Listings />);
    const rows = await screen.findAllByRole('row');
    const cells = (title) => within(rows.find((r) => r.textContent.includes(title)));
    expect(cells('Spacious').getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(cells('Draft flat').getByRole('button', { name: 'Publish' })).toBeTruthy();
    expect(cells('Waiting flat').getByRole('link', { name: 'Review' })).toBeTruthy();
    expect(cells('Old flat').queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(cells('Draft flat').queryByRole('button', { name: 'Feature' })).toBeNull(); // only published listings can be featured
    await user.click(cells('Spacious').getByRole('button', { name: 'Feature' }));
    expect(adminApi.setFeatured).toHaveBeenCalledWith('p1', true);
  });
  it('changes status in one click', async () => {
    load([row({ id: 'p2', title: 'Draft flat', status: 'draft' })]); propertiesApi.setStatus.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Listings />);
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(propertiesApi.setStatus).toHaveBeenCalledWith('p2', 'published');
  });
  it('archiving and deleting both ask first, and say what will happen', async () => {
    load([row()]); propertiesApi.setStatus.mockResolvedValue({}); propertiesApi.remove.mockResolvedValue({ deleted: true });
    const user = userEvent.setup();
    renderAt(<Listings />);
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    expect(propertiesApi.setStatus).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
    expect(propertiesApi.setStatus).toHaveBeenCalledWith('p1', 'archived');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(within(screen.getByRole('dialog')).getByText(/deleted for good/)).toBeTruthy();
    expect(propertiesApi.remove).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete listing' }));
    expect(propertiesApi.remove).toHaveBeenCalledWith('p1');
  });
  it('searches and filters through the URL, and links to adding and editing', async () => {
    load([row()]);
    const user = userEvent.setup();
    renderAt(<Listings />, '/admin/properties?status=published');
    expect(adminApi.properties).toHaveBeenCalledWith({ page: 1, limit: 15, status: 'published' });
    await user.type(await screen.findByRole('searchbox', { name: 'Search listings' }), 'GF-1{enter}');
    expect(url()).toContain('q=GF-1');
    expect(screen.getByRole('link', { name: /Add listing/ }).getAttribute('href')).toBe('/admin/properties/new');
    expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe('/admin/properties/p1/edit');
  });
});

describe('users', () => {
  const person = (over = {}) => ({ id: 'u1', name: 'Olivia Owner', email: 'o@x.com', phone: null, role: 'owner', isActive: true, isEmailVerified: true, verificationStatus: 'none', createdAt: '2026-08-01T00:00:00Z', listingCount: 3, ...over });
  const load = (users) => adminApi.users.mockResolvedValue({ users, meta: meta(users.length) });

  it('suspending needs a reason and reports what it did', async () => {
    load([person()]); adminApi.setUserStatus.mockResolvedValue({ user: { id: 'u1', name: 'Olivia Owner', isActive: false, pausedListings: 3 } });
    const user = userEvent.setup();
    renderAt(<Users />);
    await user.click(await screen.findByRole('button', { name: /^Suspend/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Suspend account' }));
    expect(dialog.getByText('Please write at least 5 characters.')).toBeTruthy(); expect(adminApi.setUserStatus).not.toHaveBeenCalled();
    await user.type(dialog.getByLabelText('Reason'), 'Repeated fake listings');
    await user.click(dialog.getByRole('button', { name: 'Suspend account' }));
    expect(adminApi.setUserStatus).toHaveBeenCalledWith('u1', { isActive: false, reason: 'Repeated fake listings' });
    expect(await screen.findByText(/3 live listing\(s\) were paused/)).toBeTruthy();
  });
  it('reactivating asks first, and needs no reason', async () => {
    load([person({ isActive: false, suspensionReason: 'Fake listings' })]); adminApi.setUserStatus.mockResolvedValue({ user: { id: 'u1', name: 'Olivia Owner', isActive: true, restoredListings: 2 } });
    const user = userEvent.setup();
    renderAt(<Users />);
    expect(await screen.findByText('Fake listings')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reactivate' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivate' }));
    expect(adminApi.setUserStatus).toHaveBeenCalledWith('u1', { isActive: true });
    expect(await screen.findByText(/2 listing\(s\) were restored/)).toBeTruthy();
  });
  it('offers no actions for administrators or for yourself', async () => {
    load([person({ id: 'admin1', name: 'Ada Admin', role: 'admin' }), person({ id: 'admin2', name: 'Other Admin', role: 'admin' }), person()]);
    renderAt(<Users />);
    await screen.findByText('Other Admin');
    expect(screen.getByText('This is you')).toBeTruthy(); expect(screen.getByText('Protected')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Suspend/ })).toHaveLength(1); // only the owner
  });
  it('filters by role and status and searches by name or email, through the URL', async () => {
    load([person()]);
    const user = userEvent.setup();
    renderAt(<Users />);
    await screen.findByText('Olivia Owner');
    await user.selectOptions(screen.getByLabelText('Role'), 'agent');
    expect(url()).toBe('/?role=agent');
    await user.selectOptions(screen.getByLabelText('Status'), 'suspended');
    expect(url()).toContain('status=suspended');
    await waitFor(() => expect(adminApi.users).toHaveBeenLastCalledWith({ page: 1, limit: 20, role: 'agent', status: 'suspended' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'olivia{enter}');
    expect(url()).toContain('q=olivia');
  });
});

describe('reports', () => {
  const report = (over = {}) => ({ id: 'r1', reason: 'fake_listing', description: 'Photos are from another site', status: 'open', createdAt: new Date().toISOString(), resolution: null, reviewedBy: null,
    reporter: { id: 'b1', name: 'Bilal Buyer', email: 'b@x.com' }, property: { id: 'p1', title: 'Spacious house', slug: 'house-1', status: 'published' }, ...over });
  const load = (reports) => adminApi.reports.mockResolvedValue({ reports, meta: meta(reports.length) });

  it('opens on the open reports and shows what was reported and by whom', async () => {
    load([report()]);
    renderAt(<Reports />);
    expect(await screen.findByText('Fake listing')).toBeTruthy();
    expect(adminApi.reports).toHaveBeenCalledWith({ status: 'open', page: 1, limit: 10 });
    expect(screen.getByText(/Photos are from another site/)).toBeTruthy(); expect(screen.getByText(/Bilal Buyer \(b@x.com\)/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Spacious house' }).getAttribute('href')).toBe('/properties/house-1');
  });
  it('starts a review, then resolves with a note and a decision about the listing', async () => {
    load([report()]); adminApi.updateReport.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Reports />);
    await user.click(await screen.findByRole('button', { name: 'Start review' }));
    expect(adminApi.updateReport).toHaveBeenCalledWith('r1', { status: 'under_review' });
    await user.click(screen.getByRole('button', { name: /^Resolve/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Resolve report' }));
    expect(dialog.getByText('Please write at least 3 characters.')).toBeTruthy();
    await user.type(dialog.getByLabelText('Outcome note'), 'Confirmed fake');
    await user.selectOptions(dialog.getByLabelText('What should happen to the listing?'), 'pause');
    await user.click(dialog.getByRole('button', { name: 'Resolve report' }));
    expect(adminApi.updateReport).toHaveBeenLastCalledWith('r1', { status: 'resolved', resolution: 'Confirmed fake', propertyAction: 'pause' });
  });
  it('dismissing needs a note, and finished reports show the outcome with no more actions', async () => {
    load([report()]); adminApi.updateReport.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Reports />);
    await user.click(await screen.findByRole('button', { name: /^Dismiss/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Why is this not a problem?'), 'Checked, all correct');
    await user.click(dialog.getByRole('button', { name: 'Dismiss report' }));
    expect(adminApi.updateReport).toHaveBeenCalledWith('r1', { status: 'dismissed', resolution: 'Checked, all correct' });
    cleanup(); load([report({ status: 'resolved', resolution: 'Confirmed fake', reviewedBy: 'Ada Admin' })]);
    renderAt(<Reports />, '/admin/reports?status=resolved');
    expect(await screen.findByText(/Confirmed fake/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Resolve/ })).toBeNull();
  });
  it('says so when the listing was removed, and shows the server\'s reason if an action fails', async () => {
    load([report({ property: { id: 'p1', title: 'Gone house', slug: null, status: 'removed' } })]); adminApi.updateReport.mockRejectedValue({ message: 'The reported listing no longer exists.' });
    const user = userEvent.setup();
    renderAt(<Reports />);
    expect(await screen.findByText('Removed')).toBeTruthy(); expect(screen.queryByRole('link', { name: 'Gone house' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Start review' }));
    expect(await screen.findByText('The reported listing no longer exists.')).toBeTruthy();
  });
});

describe('verification requests (admin)', () => {
  const doc = (over = {}) => ({ id: 'd1', format: 'jpg', originalName: 'id.jpg', bytes: 20480, ...over });
  const req = (over = {}) => ({ id: 'v1', status: 'pending', verificationType: 'agent', message: 'My agency licence', submittedAt: new Date().toISOString(), documentCount: 1, documents: [doc()], rejectionReason: null,
    user: { id: 'u1', name: 'Aamir Agent', email: 'a@x.com', role: 'agent' }, ...over });
  const load = (items) => adminApi.verifications.mockResolvedValue({ verifications: items, meta: meta(items.length) });

  it('opens a document through a short-lived link, in a window opened by the click', async () => {
    load([req()]); adminApi.documentLink.mockResolvedValue({ url: 'https://signed.example/doc', expiresAt: '2030-01-01' });
    const win = { opener: 'x', location: { href: '' }, close: vi.fn() }; const spy = vi.spyOn(window, 'open').mockReturnValue(win);
    const user = userEvent.setup();
    renderAt(<Verifications />);
    await user.click(await screen.findByRole('button', { name: /id\.jpg/ }));
    expect(spy).toHaveBeenCalledWith('about:blank', '_blank');
    await waitFor(() => expect(win.location.href).toBe('https://signed.example/doc'));
    expect(adminApi.documentLink).toHaveBeenCalledWith('v1', 'd1'); expect(win.opener).toBeNull();
    expect(await screen.findByRole('link', { name: /Open link/ })).toBeTruthy(); // a fallback if the browser blocked the window
    spy.mockRestore();
  });
  it('closes the blank window and explains if the link cannot be made', async () => {
    load([req()]); adminApi.documentLink.mockRejectedValue({ message: 'Document not found.' });
    const win = { close: vi.fn() }; const spy = vi.spyOn(window, 'open').mockReturnValue(win);
    const user = userEvent.setup();
    renderAt(<Verifications />);
    await user.click(await screen.findByRole('button', { name: /id\.jpg/ }));
    expect(await screen.findByText('Document not found.')).toBeTruthy(); expect(win.close).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('approving asks first, and rejecting needs a reason', async () => {
    load([req()]); adminApi.decideVerification.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Verifications />);
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(adminApi.decideVerification).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    expect(adminApi.decideVerification).toHaveBeenCalledWith('v1', { decision: 'approve' });
    await user.click(await screen.findByRole('button', { name: /^Reject/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Reject request' }));
    expect(dialog.getByText('Please write at least 5 characters.')).toBeTruthy();
    await user.type(dialog.getByLabelText(/Reason/), 'The photo is unreadable');
    await user.click(dialog.getByRole('button', { name: 'Reject request' }));
    expect(adminApi.decideVerification).toHaveBeenLastCalledWith('v1', { decision: 'reject', reason: 'The photo is unreadable' });
  });
  it('decided requests show no documents (they are deleted) and approved ones can be revoked', async () => {
    load([req({ status: 'approved', documents: [], documentCount: 2, rejectionReason: null })]); adminApi.decideVerification.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Verifications />, '/admin/verifications?status=approved');
    expect(await screen.findByText(/2 documents were reviewed and deleted/)).toBeTruthy(); expect(screen.queryByRole('list', { name: 'Documents' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Revoke/ }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Reason/), 'Documents were forged');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke verification' }));
    expect(adminApi.decideVerification).toHaveBeenCalledWith('v1', { decision: 'revoke', reason: 'Documents were forged' });
  });
});

describe('property types', () => {
  const cats = () => ['house', 'apartment', 'plot', 'commercial', 'office', 'shop'].map((key, i) => ({ key, isActive: true, sortOrder: (i + 1) * 10 }));
  beforeEach(() => adminApi.categories.mockReset().mockResolvedValue({ categories: cats() }));

  it('lists the types in order and hides one', async () => {
    adminApi.updateCategory.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Categories />);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(6); expect(items[0].textContent).toContain('House');
    await user.click(within(items[5]).getByRole('button', { name: 'Hide' }));
    expect(adminApi.updateCategory).toHaveBeenCalledWith('shop', { isActive: false });
  });
  it('reordering swaps the positions of two neighbours; the ends cannot move further', async () => {
    adminApi.updateCategory.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Categories />);
    await screen.findAllByRole('listitem');
    expect(screen.getByRole('button', { name: 'Move House up' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Move Shop down' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Move Apartment / flat up' }));
    await waitFor(() => expect(adminApi.updateCategory).toHaveBeenCalledTimes(2));
    expect(adminApi.updateCategory.mock.calls).toEqual([['apartment', { sortOrder: 10 }], ['house', { sortOrder: 20 }]]);
  });
  it('explains when the last type cannot be hidden', async () => {
    adminApi.updateCategory.mockRejectedValue({ message: 'At least one property type must stay available.' });
    const user = userEvent.setup();
    renderAt(<Categories />);
    await user.click(within((await screen.findAllByRole('listitem'))[0]).getByRole('button', { name: 'Hide' }));
    expect(await screen.findByText('At least one property type must stay available.')).toBeTruthy();
  });
  it('forms offer only the types that are active, in the chosen order, and keep a listing\'s own type', async () => {
    categoriesApi.list.mockResolvedValue([{ key: 'shop', isActive: true, sortOrder: 5 }, { key: 'house', isActive: true, sortOrder: 10 }, { key: 'plot', isActive: true, sortOrder: 20 }]);
    const Probe = ({ keep }) => <ul>{useActiveTypes(keep).map((t) => <li key={t.value}>{t.value}</li>)}</ul>;
    renderAt(<Probe />);
    await waitFor(() => expect(screen.getAllByRole('listitem').map((l) => l.textContent)).toEqual(['shop', 'house', 'plot']));
    cleanup(); renderAt(<Probe keep="office" />);
    await waitFor(() => expect(screen.getAllByRole('listitem').map((l) => l.textContent)).toContain('office'));
  });
});

describe('audit log', () => {
  const entry = (over = {}) => ({ id: 'l1', action: 'user.suspend', targetType: 'user', targetId: 'u1', summary: 'Suspended Olivia (o@x.com)', meta: { reason: 'Repeated fake listings' }, createdAt: '2026-10-12T05:00:00.000Z', actor: { id: 'admin1', name: 'Ada Admin' }, ...over });
  beforeEach(() => adminApi.auditLogs.mockReset().mockResolvedValue({ logs: [entry(), entry({ id: 'l2', action: 'listing.approve', summary: 'Approved listing: House', meta: {} })], meta: meta(2) }));

  it('shows who did what and when, in Pakistan time, with the reason', async () => {
    renderAt(<AuditLog />);
    const table = within(await screen.findByRole('table', { name: 'Audit log' }));
    expect(table.getByText('User suspended')).toBeTruthy(); expect(table.getByText('Listing approved')).toBeTruthy(); expect(table.getAllByText('Ada Admin')).toHaveLength(2);
    expect(table.getByText('Reason: Repeated fake listings')).toBeTruthy(); expect(table.getAllByText(/10:00 am/).length).toBeGreaterThan(0);
  });
  it('filters by action and dates through the URL, and flags reversed dates', async () => {
    const user = userEvent.setup();
    renderAt(<AuditLog />);
    await screen.findByRole('table', { name: 'Audit log' });
    await user.selectOptions(screen.getByLabelText('Action'), 'user.suspend');
    expect(url()).toBe('/?action=user.suspend');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });
    expect(await screen.findByText('Before the start date')).toBeTruthy();
    await waitFor(() => expect(adminApi.auditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'user.suspend', from: '2026-10-05', to: '2026-10-01' })));
  });
});

describe('applying for verification', () => {
  const asOwner = () => { auth.current = { status: 'authenticated', isAuthenticated: true, refreshUser: vi.fn(async () => {}), user: { id: 'u1', name: 'Olivia', role: 'owner', isEmailVerified: true } }; };
  const png = (name = 'id.png', size = 2048, type = 'image/png') => { const f = new File(['x'], name, { type }); Object.defineProperty(f, 'size', { value: size }); return f; };
  beforeEach(() => { asOwner(); verificationApi.me.mockReset().mockResolvedValue({ verificationStatus: 'none', request: null }); verificationApi.submit.mockReset().mockResolvedValue({}); });

  it('needs at least one document before sending', async () => {
    const user = userEvent.setup();
    renderAt(<Verification />);
    await user.click(await screen.findByRole('button', { name: 'Send for review' }));
    expect(screen.getByText('Attach at least one document.')).toBeTruthy(); expect(verificationApi.submit).not.toHaveBeenCalled();
  });
  it('checks type, size and count itself before anything is uploaded', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderAt(<Verification />);
    const input = await screen.findByLabelText('Upload verification documents');
    await user.upload(input, [new File(['x'], 'notes.txt', { type: 'text/plain' }), png('huge.png', 6 * 1024 * 1024), png('empty.png', 0)]);
    const alert = within(screen.getByRole('alert'));
    expect(alert.getByText(/notes.txt: only JPEG, PNG, WebP or PDF/)).toBeTruthy(); expect(alert.getByText(/huge.png is larger than 5 MB/)).toBeTruthy(); expect(alert.getByText(/empty.png is empty/)).toBeTruthy();
    await user.upload(input, [png('a.png'), png('b.png'), png('c.png'), png('d.png')]);
    expect(screen.getByText(/Skipped d.png/)).toBeTruthy(); expect(within(screen.getByRole('list', { name: 'Selected files' })).getAllByRole('listitem')).toHaveLength(3);
  });
  it('sends the files and note, and lets you remove a file first', async () => {
    const user = userEvent.setup();
    renderAt(<Verification />);
    const input = await screen.findByLabelText('Upload verification documents');
    const a = png('id.png'); const b = png('deed.pdf', 1000, 'application/pdf');
    await user.upload(input, [a, b]);
    await user.click(screen.getByRole('button', { name: 'Remove deed.pdf' }));
    await user.type(screen.getByLabelText(/Note for the reviewer/), 'My agency licence');
    await user.click(screen.getByRole('button', { name: 'Send for review' }));
    await waitFor(() => expect(verificationApi.submit).toHaveBeenCalledWith('My agency licence', [a]));
  });
  it('shows a server refusal on the form', async () => {
    verificationApi.submit.mockRejectedValue({ message: 'You already have a verification request under review.' });
    const user = userEvent.setup();
    renderAt(<Verification />);
    await user.upload(await screen.findByLabelText('Upload verification documents'), png());
    await user.click(screen.getByRole('button', { name: 'Send for review' }));
    expect(await screen.findByText('You already have a verification request under review.')).toBeTruthy();
  });
  it('a pending request shows its status and no form; a verified account shows the badge notice', async () => {
    verificationApi.me.mockResolvedValue({ verificationStatus: 'pending', request: { status: 'pending', submittedAt: new Date().toISOString(), documentCount: 2 } });
    renderAt(<Verification />);
    expect(await screen.findByText('Your request is under review')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Send for review' })).toBeNull();
    cleanup(); verificationApi.me.mockResolvedValue({ verificationStatus: 'verified', request: { status: 'approved' } });
    renderAt(<Verification />);
    expect(await screen.findByText('You are verified')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Send for review' })).toBeNull();
  });
  it('after a rejection it shows the reason and lets the person apply again', async () => {
    verificationApi.me.mockResolvedValue({ verificationStatus: 'rejected', request: { status: 'rejected', rejectionReason: 'The photo is unreadable', documentCount: 1 } });
    renderAt(<Verification />);
    expect(await screen.findByText(/The photo is unreadable/)).toBeTruthy(); expect(screen.getByRole('button', { name: 'Send for review' })).toBeTruthy();
  });
});

describe('listing form as an administrator', () => {
  const draft = { id: 'p1', status: 'draft', title: 'Spacious house in DHA', description: 'A bright, well-kept house close to the park and the main road.', purpose: 'sale', propertyType: 'house', condition: 'used', price: 15000000, currency: 'PKR',
    coveredArea: 5, areaUnit: 'marla', amenities: [], images: [{ id: 'i1', url: 'https://res.cloudinary.com/demo/image/upload/x.jpg', isCover: true, altText: '' }], location: { city: 'Lahore', neighborhood: 'DHA', hideExactAddress: true, coordinates: null } };
  const walk = async (user) => { for (let i = 0; i < 5; i += 1) await user.click(screen.getByRole('button', { name: 'Continue' })); };
  beforeEach(() => { adminApi.users.mockReset().mockResolvedValue({ users: [{ id: 'o1', name: 'Olivia Owner', email: 'o@x.com', role: 'owner' }], meta: meta() }); ['update', 'setStatus', 'create'].forEach((k) => propertiesApi[k].mockReset().mockResolvedValue({ property: { ...draft } })); });

  it('publishes straight away and returns to the admin list', async () => {
    const user = userEvent.setup();
    renderAt(<PropertyForm property={draft} admin basePath="/admin/properties" />, '/admin/properties/p1/edit');
    await walk(user);
    await user.click(screen.getByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(propertiesApi.setStatus).toHaveBeenCalledWith('p1', 'published'));
    expect(propertiesApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({ title: 'Spacious house in DHA', propertyType: 'house' }));
    await waitFor(() => expect(url()).toBe('/admin/properties'));
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });
  it('an owner submitting the same listing goes through review instead, and returns to their own list', async () => {
    auth.current.user = { id: 'o1', role: 'owner', isEmailVerified: true, name: 'Olivia' };
    const user = userEvent.setup();
    renderAt(<PropertyForm property={draft} />, '/dashboard/properties/p1/edit');
    await walk(user);
    expect(screen.queryByRole('button', { name: 'Publish now' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(propertiesApi.setStatus).toHaveBeenCalledWith('p1', 'pending_review'));
    await waitFor(() => expect(url()).toBe('/dashboard/properties'));
  });
  it('a new listing asks the administrator to choose its owner first, and sends the chosen owner', async () => {
    const user = userEvent.setup();
    renderAt(<PropertyForm admin basePath="/admin/properties" property={undefined} />, '/admin/properties/new');
    expect(screen.getByRole('group', { name: 'Listing owner' })).toBeTruthy();
    await user.type(screen.getByLabelText('Find an owner or agent'), 'oli');
    await waitFor(() => expect(adminApi.users).toHaveBeenCalledWith({ role: 'owner,agent', status: 'active', q: 'oli', limit: 10 }), { timeout: 2000 });
    await user.selectOptions(await screen.findByLabelText('Owner or agent'), 'o1');
    expect(screen.getByLabelText('Owner or agent').value).toBe('o1');
  });
  it('ordinary owners never see the owner picker', async () => {
    auth.current.user = { id: 'o1', role: 'owner', isEmailVerified: true, name: 'Olivia' };
    renderAt(<PropertyForm />, '/dashboard/properties/new');
    expect(screen.queryByRole('group', { name: 'Listing owner' })).toBeNull();
  });
});
