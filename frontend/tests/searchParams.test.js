import { describe, it, expect } from 'vitest';
import { parseFilters, parsePage, parseView, toSearchParams, toApiQuery, activeChips, DEFAULT_FILTERS } from '../src/utils/searchParams';

const sp = (s) => new URLSearchParams(s);

describe('parseFilters', () => {
  it('reads a shared search link', () => {
    const f = parseFilters(sp('purpose=sale&city=Lahore&type=house,apartment&minPrice=5000000&maxPrice=25000000&bedrooms=3&amenities=parking,gym&verified=true&postedWithin=7&sort=price_asc'));
    expect(f).toMatchObject({ purpose: 'sale', city: 'Lahore', type: ['house', 'apartment'], minPrice: '5000000', maxPrice: '25000000', bedrooms: '3', amenities: ['parking', 'gym'], verified: true, postedWithin: '7', sort: 'price_asc' });
  });
  it('drops anything invalid so it never reaches the API', () => {
    const f = parseFilters(sp('purpose=barter&type=castle,house&minPrice=-5&maxPrice=abc&bedrooms=x&amenities=jacuzzi&sort=cheapest&postedWithin=3&areaUnit=acre&furnishing=bare'));
    expect(f).toMatchObject({ purpose: '', type: ['house'], minPrice: '', maxPrice: '', bedrooms: '', amenities: [], sort: '', postedWithin: '', areaUnit: 'marla', furnishing: '' });
  });
  it('keeps a zero minimum for bedrooms, and ignores half a location', () => {
    expect(parseFilters(sp('bedrooms=0')).bedrooms).toBe('0');
    const f = parseFilters(sp('lat=31.5&radiusKm=10'));
    expect([f.lat, f.lng, f.radiusKm]).toEqual(['', '', '']);
    expect(parseFilters(sp('lat=31.5&lng=74.3&radiusKm=5'))).toMatchObject({ lat: '31.5', lng: '74.3', radiusKm: '5' });
    expect(parseFilters(sp('lat=300&lng=74.3')).lat).toBe('');
  });
  it('parses page and view with safe fallbacks', () => {
    expect([parsePage(sp('page=3')), parsePage(sp('page=0')), parsePage(sp('page=abc')), parsePage(sp('page=1.7'))]).toEqual([3, 1, 1, 1]);
    expect([parseView(sp('view=map')), parseView(sp('view=cube')), parseView(sp(''))]).toEqual(['map', 'grid', 'grid']);
  });
});

describe('toSearchParams', () => {
  it('leaves out defaults and empty values', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(toSearchParams({ ...DEFAULT_FILTERS, city: 'Lahore', purpose: 'sale' }, { page: 2, view: 'map' }).toString()).toBe('purpose=sale&city=Lahore&view=map&page=2');
  });
  it('includes the area unit only when an area is set, and keeps a zero bedroom minimum', () => {
    expect(toSearchParams({ ...DEFAULT_FILTERS, minArea: '5' }).get('areaUnit')).toBe('marla');
    expect(toSearchParams({ ...DEFAULT_FILTERS, areaUnit: 'kanal' }).has('areaUnit')).toBe(false);
    expect(toSearchParams({ ...DEFAULT_FILTERS, bedrooms: '0' }).get('bedrooms')).toBe('0');
  });
  it('round-trips every filter', () => {
    const f = { ...DEFAULT_FILTERS, q: 'garden villa', purpose: 'rent', type: ['house', 'shop'], city: 'Karachi', neighborhood: 'Clifton', minPrice: '50000', maxPrice: '150000', minArea: '5', maxArea: '10', areaUnit: 'marla',
      bedrooms: '2', bathrooms: '1', furnishing: 'furnished', condition: 'new', amenities: ['gym', 'parking'], verified: true, postedWithin: '30', sort: 'oldest', lat: '24.8', lng: '67', radiusKm: '25' };
    expect(parseFilters(toSearchParams(f))).toEqual(f);
  });
  it('uses the page size and builds the API query', () => {
    expect(toApiQuery({ ...DEFAULT_FILTERS, city: 'Lahore', type: ['house'] }, { page: 3, limit: 12 })).toEqual({ city: 'Lahore', type: 'house', page: 3, limit: 12 });
  });
});

describe('activeChips', () => {
  const f = { ...DEFAULT_FILTERS, purpose: 'sale', city: 'Lahore', neighborhood: 'DHA', type: ['house', 'plot'], minPrice: '5000000', maxPrice: '25000000', minArea: '5', amenities: ['gym'], verified: true, lat: '31.5', lng: '74.3', radiusKm: '10', q: 'villa' };
  it('describes each active filter in plain words', () => {
    const labels = activeChips(f).map((c) => c.label);
    expect(labels).toEqual(['"villa"', 'For sale', 'House', 'Plot / land', 'Lahore', 'DHA', 'PKR 50 Lakh to PKR 2.5 Crore', 'From 5 Marla', 'Gym', 'Verified listers', 'Within 10 km of you']);
  });
  it('removes just one filter per chip', () => {
    const chip = (id) => activeChips(f).find((c) => c.id === id);
    expect(chip('type:house').clear(f).type).toEqual(['plot']);
    expect(chip('amenity:gym').clear(f).amenities).toEqual([]);
    expect(chip('price').clear(f)).toMatchObject({ minPrice: '', maxPrice: '', city: 'Lahore' });
    expect(chip('city').clear(f)).toMatchObject({ city: '', neighborhood: '' }); // a neighborhood makes no sense without its city
    expect(chip('near').clear(f)).toMatchObject({ lat: '', lng: '', radiusKm: '' });
  });
  it('has no chips for the default state', () => expect(activeChips(DEFAULT_FILTERS)).toEqual([]));
});
