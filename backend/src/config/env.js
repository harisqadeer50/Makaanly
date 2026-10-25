import dns from 'node:dns';
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
import { z } from 'zod';

const DEV_SECRET = 'dev-only-secret-change-me-dev-only-secret-change-me';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().min(1).default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/makaanly'),
  SITE_URL: z.string().optional().default(''), // public address of the website, used in the sitemap. Defaults to the first CLIENT_URL
  // How many proxies sit in front of the API. 1 = only the hosting platform's load balancer; 2 = a frontend host that proxies /api (Vercel/Netlify rewrites) in front of it.
  // It decides which address counts as "the visitor", which rate limiting depends on.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  COOKIE_MODE: z.enum(['same-site', 'cross-site']).default('same-site'),
  JWT_ACCESS_SECRET: z.string().default(DEV_SECRET),
  JWT_REFRESH_SECRET: z.string().default(DEV_SECRET), // reserved: refresh tokens are opaque and hashed in the DB
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Makaanly <no-reply@makaanly.example>'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const base = parsed.data;
if (base.NODE_ENV === 'production' && (base.JWT_ACCESS_SECRET === DEV_SECRET || base.JWT_ACCESS_SECRET.length < 32)) {
  console.error('JWT_ACCESS_SECRET must be set to a random string of at least 32 characters in production.');
  process.exit(1);
}

if (base.NODE_ENV === 'production') {
  const problems = [];
  const origins = base.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean);
  if (/^mongodb:\/\/(127\.0\.0\.1|localhost)/.test(base.MONGODB_URI)) problems.push('MONGODB_URI points at a local database. Use your MongoDB Atlas connection string.');
  if (origins.some((o) => !o.startsWith('https://'))) problems.push('CLIENT_URL must use https:// in production (secure cookies and CORS depend on it).');
  if (origins.some((o) => o.includes('*'))) problems.push('CLIENT_URL must list exact origins, not wildcards.');
  if (problems.length) { console.error(`Unsafe production configuration:\n- ${problems.join('\n- ')}`); process.exit(1); }
}

export const env = {
  ...base,
  clientOrigins: base.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean),
  cloudinaryConfigured: Boolean(base.CLOUDINARY_CLOUD_NAME && base.CLOUDINARY_API_KEY && base.CLOUDINARY_API_SECRET),
  smtpConfigured: Boolean(base.SMTP_HOST),
  siteUrl: (base.SITE_URL || base.CLIENT_URL.split(',')[0].trim()).replace(/\/+$/, ''),
};
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
