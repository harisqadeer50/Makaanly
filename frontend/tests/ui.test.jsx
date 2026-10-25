// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ status: 'guest', isAuthenticated: false, user: null }), AuthProvider: ({ children }) => children }));
vi.mock('../src/services/admin.js', () => ({ categoriesApi: { list: vi.fn(async () => ['house', 'apartment', 'plot', 'commercial', 'office', 'shop'].map((key, i) => ({ key, isActive: true, sortOrder: (i + 1) * 10 }))) } }));
vi.mock('../src/services/properties.js', () => ({ propertiesApi: { list: vi.fn(), locations: vi.fn() } }));
const { propertiesApi } = await import('../src/services/properties.js');
const { ToastProvider } = await import('../src/components/common/Toast.jsx');
const { default: Properties } = await import('../src/pages/Properties.jsx');
const { default: HeroSearch } = await import('../src/components/property/HeroSearch.jsx');

const prop = (n, over = {}) => ({
  id: `p${n}`, slug: `listing-${n}`, title: `Listing number ${n}`, description: 'A nice home.', purpose: 'sale', propertyType: 'house', price: 15000000, currency: 'PKR',
  coveredArea: 5, areaUnit: 'marla', bedrooms: 3, bathrooms: 2, images: [], owner: { name: 'Sam', isVerified: false }, location: { city: 'Lahore', neighborhood: 'DHA' }, ...over,
});
const Where = () => { const l = useLocation(); return <output data-testid="url">{l.pathname}{l.search}</output>; };
const renderAt = (ui, url) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter initialEntries={[url]}>{ui}<Where /></MemoryRouter></ToastProvider></QueryClientProvider>);
};
const url = () => screen.getByTestId('url').textContent;

beforeEach(() => {
  propertiesApi.list.mockReset().mockResolvedValue({ properties: [prop(1), prop(2)], meta: { total: 2, totalPages: 1, page: 1 } });
  propertiesApi.locations.mockReset().mockResolvedValue({ cities: [{ name: 'Lahore', count: 2 }, { name: 'Karachi', count: 0 }], neighborhoods: [{ name: 'DHA', count: 2 }] });
});
afterEach(cleanup);

describe('search page', () => {
  it('turns the URL into an API query, shows results and the right chips', async () => {
    renderAt(<Properties />, '/properties?purpose=sale&city=Lahore&type=house&minPrice=5000000&bedrooms=3&page=2');
    expect(await screen.findByText('Listing number 1')).toBeTruthy();
    expect(propertiesApi.list).toHaveBeenCalledWith({ purpose: 'sale', city: 'Lahore', type: 'house', minPrice: '5000000', bedrooms: '3', page: 2, limit: 12 });
    const chips = within(screen.getByRole('list', { name: 'Active filters' }));
    for (const label of ['For sale', 'Lahore', 'House', 'From PKR 50 Lakh', '3+ bedrooms']) expect(chips.getByText(label)).toBeTruthy();
    expect(screen.getByText('2 properties found')).toBeTruthy();
  });

  it('removing a chip updates the URL and resets to page 1; "Clear all" empties it', async () => {
    const user = userEvent.setup();
    renderAt(<Properties />, '/properties?purpose=sale&city=Lahore&page=2');
    await screen.findByText('Listing number 1');
    await user.click(screen.getByRole('button', { name: 'Remove filter: Lahore' }));
    expect(url()).toBe('/properties?purpose=sale');
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(url()).toBe('/properties');
  });

  it('ignores invalid parameters instead of sending them to the API', async () => {
    renderAt(<Properties />, '/properties?purpose=barter&minPrice=abc&type=castle&sort=cheapest');
    await screen.findByText('Listing number 1');
    expect(propertiesApi.list).toHaveBeenCalledWith({ page: 1, limit: 12 });
  });

  it('searching by keyword and changing the view and sort are reflected in the URL', async () => {
    const user = userEvent.setup();
    renderAt(<Properties />, '/properties');
    await screen.findByText('Listing number 1');
    await user.type(screen.getByRole('searchbox', { name: 'Search properties' }), 'bahria villa{enter}');
    expect(url()).toBe('/properties?q=bahria+villa');
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(url()).toContain('view=list');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'price_asc');
    expect(url()).toContain('sort=price_asc');
  });

  it('applies a sidebar filter immediately, and typed numbers after a pause', async () => {
    const user = userEvent.setup();
    renderAt(<Properties />, '/properties');
    await screen.findByText('Listing number 1');
    const sidebar = within(screen.getAllByRole('form', { name: 'Filters' })[0]);
    await user.selectOptions(sidebar.getByLabelText('Purpose'), 'rent');
    expect(url()).toBe('/properties?purpose=rent');
    await user.type(sidebar.getAllByLabelText('Min')[0], '90000');
    await waitFor(() => expect(url()).toContain('minPrice=90000'), { timeout: 2000 });
  });

  it('shows the empty state with a way out when nothing matches', async () => {
    propertiesApi.list.mockResolvedValue({ properties: [], meta: { total: 0, totalPages: 0, page: 1 } });
    const user = userEvent.setup();
    renderAt(<Properties />, '/properties?city=Nowhere');
    expect(await screen.findByText('No properties match your search')).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Clear all filters' })[0]);
    expect(url()).toBe('/properties');
  });

  it('shows the error state with a retry that refetches', async () => {
    propertiesApi.list.mockRejectedValueOnce({ message: 'Cannot reach the server.' });
    const user = userEvent.setup();
    renderAt(<Properties />, '/properties');
    expect(await screen.findByText('Cannot reach the server.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Listing number 1')).toBeTruthy();
  });

  it('opens the mobile filter sheet and applies only when asked', async () => {
    const user = userEvent.setup();
    renderAt(<Properties />, '/properties');
    await screen.findByText('Listing number 1');
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(dialog.getByLabelText('Purpose'), 'rent');
    expect(url()).toBe('/properties'); // not applied yet
    await user.click(dialog.getByRole('button', { name: 'Show results' }));
    expect(url()).toBe('/properties?purpose=rent');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the list layout with descriptions', async () => {
    renderAt(<Properties />, '/properties?view=list');
    expect((await screen.findAllByText('A nice home.')).length).toBe(2);
  });
});

describe('home search', () => {
  const fill = async (user, where) => { if (where) await user.type(screen.getByLabelText('City or neighborhood'), where); };

  it('sends a known city as an exact filter', async () => {
    const user = userEvent.setup();
    renderAt(<HeroSearch />, '/');
    await fill(user, 'lahore');
    await user.type(screen.getByLabelText('Max price (PKR)'), '25000000');
    await user.selectOptions(screen.getByLabelText('Bedrooms'), '3');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(url()).toBe('/properties?purpose=sale&city=Lahore&maxPrice=25000000&bedrooms=3');
  });

  it('sends anything else as a keyword search, and the Rent tab as rent', async () => {
    const user = userEvent.setup();
    renderAt(<HeroSearch />, '/');
    await user.click(screen.getByRole('tab', { name: 'Rent' }));
    await fill(user, 'Bahria Town');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(url()).toBe('/properties?q=Bahria+Town&purpose=rent');
  });

  it('the Commercial tab searches commercial types and hides the bedrooms field', async () => {
    const user = userEvent.setup();
    renderAt(<HeroSearch />, '/');
    await user.click(screen.getByRole('tab', { name: 'Commercial' }));
    expect(screen.queryByLabelText('Bedrooms')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(url()).toBe('/properties?type=commercial%2Coffice%2Cshop');
  });

  it('blocks a minimum above the maximum', async () => {
    const user = userEvent.setup();
    renderAt(<HeroSearch />, '/');
    await user.type(screen.getByLabelText('Min price (PKR)'), '900');
    await user.type(screen.getByLabelText('Max price (PKR)'), '100');
    expect(screen.getByText('Max is below min')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' }).disabled).toBe(true);
  });
});
