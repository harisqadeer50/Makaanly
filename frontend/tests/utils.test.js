import { describe, it, expect } from 'vitest';
import { formatPrice, formatArea } from '../src/utils/format';
import { cloudinaryUrl } from '../src/utils/images';
import { toPayload, fromProperty, emptyForm, propertyFormSchema, STEPS, stepOfField } from '../src/utils/propertyForm';
import { registerSchema } from '../src/utils/authSchemas';

describe('format', () => {
  it('uses lakh and crore for PKR, and shows the rent period', () => {
    expect(formatPrice({ price: 15000000, currency: 'PKR', purpose: 'sale' })).toBe('PKR 1.5 Crore');
    expect(formatPrice({ price: 250000, currency: 'PKR', purpose: 'sale' })).toBe('PKR 2.5 Lakh');
    expect(formatPrice({ price: 85000, currency: 'PKR', purpose: 'rent', rentalPeriod: 'monthly' })).toBe('PKR 85,000 / month');
  });
  it('formats areas with their unit', () => {
    expect(formatArea(10, 'marla')).toBe('10 Marla');
    expect(formatArea(1800, 'sqft')).toBe('1,800 sq ft');
    expect(formatArea(0, 'sqft')).toBeNull();
  });
});

describe('cloudinaryUrl', () => {
  it('adds auto format/quality and a fill crop to Cloudinary URLs only', () => {
    expect(cloudinaryUrl('https://res.cloudinary.com/x/image/upload/v1/a.jpg', { w: 640, h: 480 })).toBe('https://res.cloudinary.com/x/image/upload/f_auto,q_auto,w_640,h_480,c_fill/v1/a.jpg');
    expect(cloudinaryUrl('blob:http://localhost/abc', { w: 640 })).toBe('blob:http://localhost/abc');
  });
});

describe('property form helpers', () => {
  const valid = { ...emptyForm, title: '5 Marla house near park', description: 'x'.repeat(40), propertyType: 'house', price: 1500000, coveredArea: 5, location: { ...emptyForm.location, city: 'Lahore', neighborhood: 'DHA' } };
  it('turns empty optional values into null so edits can clear them, and drops rent-only fields for sales', () => {
    const p = toPayload({ ...valid, securityDeposit: 5000, rentalPeriod: 'yearly', bedrooms: undefined, furnishing: '' });
    expect(p).toMatchObject({ bedrooms: null, furnishing: null, rentalPeriod: null, securityDeposit: null, plotArea: null });
    expect(toPayload({ ...valid, purpose: 'rent', rentalPeriod: 'yearly', securityDeposit: 5000 })).toMatchObject({ rentalPeriod: 'yearly', securityDeposit: 5000 });
  });
  it('round-trips an API listing into the form and back', () => {
    const api = { title: 'T'.repeat(12), description: 'd'.repeat(40), purpose: 'rent', propertyType: 'apartment', price: 90000, currency: 'PKR', rentalPeriod: 'monthly', coveredArea: 3, areaUnit: 'marla', bedrooms: 2, amenities: ['gym'],
      location: { city: 'Lahore', neighborhood: 'DHA', hideExactAddress: true, coordinates: { lat: 31.5, lng: 74.3, approximate: false } } };
    const back = toPayload(fromProperty(api));
    expect(back).toMatchObject({ purpose: 'rent', price: 90000, bedrooms: 2, amenities: ['gym'], location: { coordinates: { lat: 31.5, lng: 74.3 } } });
  });
  it('shows readable validation messages', () => {
    const msgs = Object.fromEntries(propertyFormSchema.safeParse(emptyForm).error.issues.map((i) => [i.path.join('.'), i.message]));
    expect(msgs.propertyType).toBe('Choose a property type'); expect(msgs.price).toBe('This field is required');
    expect(registerSchema.safeParse({ name: 'Ab', email: 'a@b.co', password: 'Passw0rd1', confirmPassword: 'Passw0rd1', role: 'buyer', acceptTerms: false }).error.issues[0].message).toBe('You must accept the terms and privacy policy');
  });
  it('has a photos step and maps server errors to the right step', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['basics', 'price', 'specs', 'location', 'photos', 'review']);
    expect(stepOfField('images')).toBe(4); expect(stepOfField('location.city')).toBe(3); expect(stepOfField('coveredArea')).toBe(1);
  });
});
