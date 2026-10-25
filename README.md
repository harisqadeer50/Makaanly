# Makaanly

**Find a Place You'll Love to Call Home.**

A full-stack real estate marketplace for Pakistan, built with the MERN stack. Buyers and tenants search and contact listers; owners and agents list properties with photos; administrators moderate everything.

| Document | What's in it |
| --- | --- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step production setup: MongoDB Atlas, Cloudinary, email, Render, Vercel or Netlify, first-run commands, launch checklist, backups |
| [docs/SECURITY.md](docs/SECURITY.md) | What protects the site, how each requirement was met, and the risks that remain |
| [docs/API.md](docs/API.md) | Every API endpoint and who can call it (generated from the code) |

## What it does

**Everyone** can search published listings (by city, neighborhood, type, price, area in marla, kanal, sq ft or sq yd, bedrooms, amenities and more), view them as a grid, list or map, open full detail pages with galleries, and browse agent profiles. Search state lives in the URL, so links are shareable.

**Buyers and tenants** (after verifying their email) save favorites, message owners and agents, request viewings, report suspicious listings, and get notifications.

**Owners and agents** create listings in a six-step form with photo upload, submit them for review, pause, mark sold or rented, answer inquiries, confirm viewings, and see views, saves and inquiries per listing. Agents get a public profile and a directory entry. Both can apply for a verified badge.

**Administrators** have a separate panel: live statistics and charts, a moderation queue (approve, or reject with a reason), every listing (add, edit, delete, manage photos, feature), users (suspend and reactivate), reports, verification requests with private documents, property types, and an audit log.

Also included: in-app and email notifications, account settings (change password, sign out everywhere), SEO (titles, canonical links, structured data, sitemap, robots.txt), privacy/terms/safety/support pages, and accessibility checks.

## Technology

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form with Zod, Axios, Leaflet and OpenStreetMap, Lucide icons.
- **Backend:** Node.js 20+, Express, Mongoose, JWT in HTTP-only cookies with rotating refresh tokens, CSRF protection, Helmet, rate limiting, Multer, Cloudinary, Nodemailer.
- **Data and services:** MongoDB (Atlas), Cloudinary for photos, any SMTP provider for email.

## Run it on your computer

You need Node.js 20 or newer and a MongoDB database (local, or a free MongoDB Atlas cluster).

```bash
npm run install:all                      # installs the root, backend and frontend packages
cp backend/.env.example backend/.env     # then edit it (see below)
cp frontend/.env.example frontend/.env   # optional in development
npm run sync-indexes                     # creates the database indexes (safe to repeat)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongPass123' ADMIN_NAME='Your Name' npm run create-admin
npm run dev                              # API on http://localhost:5000, website on http://localhost:5173
```

In `backend/.env` set at least `MONGODB_URI` and `JWT_ACCESS_SECRET`. Everything else has a safe default for development:

- **Photos** need the three `CLOUDINARY_*` values. Without them the site works, but uploads answer "not set up yet".
- **Email** needs `SMTP_*`. Without it, verification and reset links are printed in the backend console, so you can still sign up and test.

The website talks to the API through a proxy that Vite sets up, so there is nothing to configure for the two to find each other.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API and the website together |
| `npm test` | Runs the backend and frontend tests |
| `npm run test:backend`, `npm run test:frontend` | One suite at a time |
| `npm run build` | Builds the website into `frontend/dist` |
| `npm run sync-indexes` | Creates or updates every database index and the default property types |
| `npm run create-admin` | Creates an administrator (or promotes an existing user). Administrators can only be created this way |
| `npm run backup --prefix backend` | Writes a compressed database backup (needs MongoDB Database Tools) |
| `npm run docs:api --prefix backend` | Regenerates `docs/API.md` from the code |

## Tests

```bash
npm test
```

- **Backend:** 211 tests run with no database. They cover validation, permissions, the status rules, search filters, viewing conflicts, privacy of what each person can see, upload checks, notifications, and an audit that fails if an endpoint is ever added without sign-in (unless it is on an explicit public list).
- **Frontend:** 236 tests render the real pages with a mocked API. They include an automated accessibility audit (axe-core) of 35 pages and dialogs, and a check of every colour pair against WCAG AA contrast.
- **Database tests:** a further 61 backend tests exercise the real database (unique indexes, simultaneous requests, session revocation). They are skipped unless you point them at a **disposable** database, whose collections are emptied between tests:

  ```bash
  TEST_MONGODB_URI=mongodb://127.0.0.1:27017/makaanly_test npm run test:backend
  ```

  The included GitHub Actions workflow (`.github/workflows/ci.yml`) runs them against a MongoDB container on every push.

## Project layout

```
backend/src
  config/       environment, database, Cloudinary, shared constants
  models/       Mongoose schemas (User, Property, Inquiry, Appointment, Report, ...)
  routes/       one file per area; thin
  controllers/  read the request, call a service, send the response
  services/     the business rules (listings, search, moderation, notifications, ...)
  middleware/   authentication, CSRF, validation, uploads, rate limits, errors
  validators/   Zod schemas for every request
  utils/        status rules, serializers, time zone and area helpers
backend/scripts   admin creation, index sync, backups, route listing
backend/tests
frontend/src
  pages/        public pages, dashboard/ and admin/
  components/   layout, property, marketplace, admin, common
  hooks/ services/ utils/ context/ content/ config/
frontend/tests
docs/
```

## Decisions worth knowing

- **Area units.** Stored as entered plus a normalized square-foot value: 1 marla = 272.25 sq ft, 1 kanal = 20 marla = 5,445 sq ft, 1 sq yd = 9 sq ft. Marla size varies by region, so change it in `backend/src/config/constants.js` if you need another standard.
- **Time zone.** Everything is stored in UTC and shown in Pakistan time (UTC+5, no daylight saving). Viewings run 09:00 to 20:00 for 30 or 60 minutes, with an hour's notice, up to 60 days ahead.
- **Listing life cycle.** draft → pending review → published → paused / sold / rented → archived. Owners cannot publish their own listing; only administrators approve. Editing the title, description, type, purpose or neighborhood of a live listing sends it back for review. Drafts are deleted; anything that has been live is archived.
- **Privacy by default.** Public pages show the neighborhood and an approximate map area, never the street address, unless the owner opts in. Contact details go only to the person they were meant for. Other people's records return "not found", not "forbidden".
- **Verification.** A verified badge appears only after an administrator approves identity and ownership or licence documents. The documents are stored privately and **deleted as soon as a decision is made**.
- **Sessions.** Short-lived access token plus a rotating refresh token, all in HTTP-only cookies; reuse of an old refresh token ends that login; changing or resetting a password signs out every other device.

## What is not included

- Account deletion is by email request (stated in the privacy policy and FAQ), not a button.
- Property types can be hidden and reordered by administrators, but not added or renamed.
- No two-factor sign-in, real-time chat, saved-search alerts, price insights or agency subscriptions.
- Social-media link previews need a pre-rendering step (search engines that run JavaScript, such as Google, already read the tags). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#social-media-previews).
- The privacy policy, terms and safety pages are sensible starting text, **not legal advice**. Have a lawyer review them for your company before launch.
- The sample testimonials on the home page are labelled as demonstration content. Hide them with `VITE_SHOW_DEMO_TESTIMONIALS=false` until you have real ones.
