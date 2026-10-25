// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ current: null }));
vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: () => auth.current, AuthProvider: ({ children }) => children }));
vi.mock('../src/services/admin.js', () => ({ categoriesApi: { list: vi.fn(async () => []) } }));
vi.mock('../src/services/properties.js', () => ({ propertiesApi: { get: vi.fn(), similar: vi.fn(), list: vi.fn() } }));
vi.mock('../src/services/marketplace.js', () => ({
  favoritesApi: { ids: vi.fn(async () => []), add: vi.fn(), remove: vi.fn() },
  inquiriesApi: { create: vi.fn() }, appointmentsApi: { create: vi.fn() }, reportsApi: { create: vi.fn() },
}));
const { propertiesApi } = await import('../src/services/properties.js');
const { ToastProvider } = await import('../src/components/common/Toast.jsx');
const { default: PropertyDetail } = await import('../src/pages/PropertyDetail.jsx');

const base = {
  id: 'p1', slug: 'spacious-house', referenceId: 'GF-ABC1234', title: 'Spacious house in DHA', description: 'A bright home near the park.', purpose: 'sale', propertyType: 'house', status: 'published',
  price: 15000000, currency: 'PKR', coveredArea: 5, areaUnit: 'marla', bedrooms: 3, bathrooms: 2, amenities: ['parking'], images: [], updatedAt: '2026-10-01T00:00:00Z', publishedAt: '2026-09-20T00:00:00Z',
  location: { city: 'Lahore', neighborhood: 'DHA', coordinates: null }, owner: { id: 'o1', name: 'Olivia Owner', role: 'owner', isVerified: false },
};
const setProperty = (over = {}, viewer = { canEdit: false }) => propertiesApi.get.mockResolvedValue({ property: { ...base, ...over }, viewer });
const asGuest = () => { auth.current = { status: 'guest', isAuthenticated: false, user: null }; };
const asUser = (over = {}) => { auth.current = { status: 'authenticated', isAuthenticated: true, user: { id: 'u1', name: 'Sam', role: 'buyer', isEmailVerified: true, ...over } }; };
const open = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter initialEntries={['/properties/spacious-house']}><Routes><Route path="/properties/:slug" element={<PropertyDetail />} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
};

beforeEach(() => { propertiesApi.similar.mockReset().mockResolvedValue({ properties: [] }); propertiesApi.list.mockReset().mockResolvedValue({ properties: [] }); setProperty(); asUser(); });
afterEach(cleanup);

describe('property detail: who can do what', () => {
  it('guests are invited to log in, and cannot see a contact form', async () => {
    asGuest(); open();
    expect(await screen.findByRole('heading', { name: 'Spacious house in DHA' })).toBeTruthy();
    expect(screen.getByText('Interested in this property?')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('people with an unverified email are asked to verify first', async () => {
    asUser({ isEmailVerified: false }); open();
    expect(await screen.findByText(/Verify your email address to contact the lister/)).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('verified people get the message form, a viewing request and the report link', async () => {
    open();
    expect(await screen.findByRole('form', { name: 'Contact the lister' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request a viewing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save Spacious house in DHA' })).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Request a viewing' }));
    expect(screen.getByRole('dialog', { name: 'Request a viewing' })).toBeTruthy();
  });

  it('opens the report dialog for a signed-in person', async () => {
    open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Report this listing' }));
    expect(screen.getByRole('dialog', { name: 'Report this listing' })).toBeTruthy();
  });

  it('the lister sees an edit button, and no way to message or report themselves', async () => {
    asUser({ id: 'o1', role: 'owner' }); setProperty({}, { canEdit: true }); open();
    expect(await screen.findByRole('link', { name: 'Edit listing' })).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Request a viewing' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Report this listing' })).toBeNull();
  });

  it('a sold listing explains itself and offers no contact options or save button', async () => {
    setProperty({ status: 'sold' }); open();
    expect(await screen.findByText(/no longer available/)).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Save / })).toBeNull();
  });

  it('a draft preview is labelled as such and cannot be contacted', async () => {
    setProperty({ status: 'draft', owner: 'o1' }, { canEdit: true, isPreview: true }); asUser({ id: 'o1', role: 'owner' }); open();
    expect(await screen.findByText(/Preview only/)).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('links an agent lister to their public profile, and shows the assigned agent over the owner', async () => {
    setProperty({ assignedAgent: { id: 'ag1', name: 'Aamir Agent', role: 'agent', isVerified: true } }); open();
    const link = await screen.findByRole('link', { name: 'Aamir Agent' });
    expect(link.getAttribute('href')).toBe('/agents/ag1');
    expect(screen.queryByText('Olivia Owner')).toBeNull();
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('shows a clear page when the listing is not public', async () => {
    propertiesApi.get.mockRejectedValue({ status: 404, message: 'Property not found' }); open();
    expect(await screen.findByText("This property isn't available")).toBeTruthy();
  });
});
