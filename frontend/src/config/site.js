// Details shown on the legal and support pages and in the footer. Set them with VITE_* variables (see .env.example).
const env = import.meta.env;
export const site = {
  name: 'Makaanly',
  tagline: "Find a Place You'll Love to Call Home.",
  companyName: env.VITE_COMPANY_NAME || 'Makaanly',
  supportEmail: env.VITE_SUPPORT_EMAIL || 'support@makaanly.example',
  supportPhone: env.VITE_SUPPORT_PHONE || '',
  address: env.VITE_COMPANY_ADDRESS || '',
  legalUpdated: '12 October 2026',
  // The testimonials on the home page are samples. Set VITE_SHOW_DEMO_TESTIMONIALS=false to hide them until you have real ones.
  showDemoTestimonials: env.VITE_SHOW_DEMO_TESTIMONIALS !== 'false',
};
