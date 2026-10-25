# Deploying Makaanly

This guide takes you from a fresh copy of the code to a live site. The recommended setup is **MongoDB Atlas** (database), **Cloudinary** (photos), an **email provider**, **Render** (the API) and **Vercel** (the website, which also forwards `/api` to the API). Netlify works the same way. Allow an afternoon.

> **Nothing here has been run against your real accounts.** The code and tests were checked in a development environment; the steps below are the part only you can do. Work through the [launch checklist](#launch-checklist) and the [smoke test](#smoke-test) before announcing the site.

## 1. How the pieces fit

```
Browser ──► Vercel (website files, and forwards /api, /sitemap.xml, /robots.txt) ──► Render (API) ──► MongoDB Atlas
                                                                                       ├─► Cloudinary (photos, private documents)
                                                                                       └─► Email provider
```

The browser only ever talks to **one address** (your website). Because the API is reached through that address, sign-in cookies are first-party, so they work in every browser, including Safari and Firefox with their strict cookie rules. This is why the files in `frontend/` forward `/api` to the API instead of having the browser call it directly.

## 2. Create the accounts and services

### MongoDB Atlas

1. Create a project and a cluster (the free tier is fine to start).
2. **Database Access:** create a database user with a strong password and the "Read and write to any database" role.
3. **Network Access:** allow your API host to connect. Render's outbound addresses change, so for a simple start allow `0.0.0.0/0` **and rely on the strong user password**; tighten this later if you move to a plan with fixed outbound addresses.
4. **Connect → Drivers:** copy the connection string and put your database name in it, for example `mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/makaanly`. This is `MONGODB_URI`.
5. **Backups:** use a paid tier with continuous backup for production, or schedule `scripts/backup.sh` (see [Backups](#backups-and-recovery)).

### Cloudinary

1. Create an account. From the dashboard copy the **cloud name**, **API key** and **API secret** (`CLOUDINARY_*`).
2. Property photos are public images. **Verification documents are stored as private ("authenticated") assets** and are only reachable through short-lived links the API creates for administrators.
3. New Cloudinary accounts may restrict delivery of PDF and ZIP files by default. If PDFs fail to open in the verification screen, enable PDF delivery in *Settings → Security*, or ask applicants to upload photos only.

### Email

Any SMTP provider works (Brevo, Resend, Postmark, Amazon SES, your host's mail server). You need `SMTP_HOST`, `SMTP_PORT` (usually 587), `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM`.

- Use a sending address on a domain you own, and set up **SPF and DKIM** records with the provider, otherwise verification and password-reset emails will land in spam. Without working email, people cannot verify their address, and unverified accounts cannot list or message.
- Without `SMTP_HOST` the API prints links to its log in development and **skips sending in production**.

## 3. Deploy the API (Render)

1. Push the project to a Git repository (GitHub, GitLab or Bitbucket). The `.gitignore` files keep `.env`, `node_modules` and build output out.
2. In Render choose **New → Blueprint** and select the repository. Render reads `render.yaml`. (Or create a Web Service by hand: root directory `backend`, build `npm ci --omit=dev`, start `node src/server.js`, health check `/api/health`.)
3. Fill in the values Render asks for (table below). `JWT_ACCESS_SECRET` is generated for you.
4. After the first deploy, open the service **Shell** and run once:

   ```bash
   npm run sync-indexes
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' ADMIN_NAME='Your Name' npm run create-admin
   ```

   `sync-indexes` matters for more than speed: several protections (one open inquiry per buyer and listing, one open report, one pending verification, no duplicate favorites) are enforced by unique indexes.
5. Visit `https://YOUR-API.onrender.com/api/health`. It should answer `{"success":true,...,"db":"connected"}`.

> **Free plans sleep.** A sleeping service takes about a minute to wake, and its background cleanup of photos pauses. Use a paid plan for a real launch.

### API environment variables

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | Your website's exact address, **https**, for example `https://www.example.com` (several can be comma-separated) |
| `SITE_URL` | The same address; used in the sitemap |
| `MONGODB_URI` | The Atlas connection string |
| `JWT_ACCESS_SECRET` | At least 32 random characters (Render generates one) |
| `COOKIE_MODE` | `same-site` (the recommended proxy setup) |
| `TRUST_PROXY` | `2` when the website's host forwards `/api` (Vercel/Netlify); `1` if the browser calls the API directly |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | From Cloudinary |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | From your email provider |

The API **refuses to start in production** with a local database, a non-https `CLIENT_URL`, a wildcard origin, or a weak secret, and tells you which.

> **`TRUST_PROXY` matters.** It tells the API how many proxies are in front of it, so it can see each visitor's real address. Behind the Vercel/Netlify forwarding it must be `2`. Set to `1` there, every visitor looks like the same person to the rate limiter and the whole site would share one allowance.

## 4. Deploy the website (Vercel)

1. Edit **`frontend/vercel.json`** and replace every `YOUR-API.onrender.com` with your API's address (four places).
2. In Vercel choose **Add New → Project**, select the repository and set **Root Directory** to `frontend`. Vercel detects Vite (build `npm run build`, output `dist`).
3. Add these **environment variables** (all optional, but set them):

   | Variable | Purpose |
   | --- | --- |
   | `VITE_SITE_URL` | Your website's address, for canonical links and structured data |
   | `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_COMPANY_NAME`, `VITE_COMPANY_ADDRESS` | Shown on the support and legal pages and in the footer |
   | `VITE_SHOW_DEMO_TESTIMONIALS` | `false` to hide the labelled sample testimonials |

   Leave `VITE_API_URL` empty: the website calls `/api` on its own address, which Vercel forwards.
4. Deploy, then add your custom domain and make sure **HTTPS** is on. Put that domain in the API's `CLIENT_URL` and `SITE_URL`, and redeploy the API.

**Netlify instead:** use `frontend/netlify.toml` (replace `YOUR-API` the same way). Base directory `frontend`, build command `npm run build`, publish directory `dist`.

The files also set strict security headers (a content security policy that only allows your own scripts, Cloudinary images and OpenStreetMap map tiles, plus HSTS, no framing, and a camera/microphone-off permissions policy). If you add another service the browser must contact (analytics, a font host), add it to the policy in the same file.

### Using a different arrangement

- **Website and API on subdomains of one domain** (`www.example.com` and `api.example.com`): set `VITE_API_URL=https://api.example.com/api`, `COOKIE_MODE=cross-site`, `TRUST_PROXY=1`, add the API address to `connect-src` in the security headers, and add `https://www.example.com` to `CLIENT_URL`. Cookies are "same-site" because the registrable domain matches.
- **Different domains** (`site.vercel.app` and `api.onrender.com`) with direct calls is **not recommended**: Safari and Firefox may block the sign-in cookie as a third-party cookie, and sign-in will appear to fail for those visitors.

## Launch checklist

- [ ] API health check shows `db: connected`.
- [ ] `npm run sync-indexes` has been run against the production database.
- [ ] An administrator account exists (`npm run create-admin`) and you can sign in to `/admin`.
- [ ] `CLIENT_URL`, `SITE_URL` and `VITE_SITE_URL` all use your final https domain.
- [ ] `TRUST_PROXY` matches how the site is arranged (see above).
- [ ] Verification and password-reset emails arrive in an inbox, not spam (SPF and DKIM set).
- [ ] Cloudinary credentials work: upload a photo; upload a PDF as a verification document and open it as an administrator.
- [ ] `https://YOUR-SITE/robots.txt` and `/sitemap.xml` load, and `robots.txt` names the sitemap with your domain.
- [ ] Privacy, terms and safety pages **reviewed by a lawyer** and the support email, phone and company address set.
- [ ] Sample testimonials hidden, or replaced with real ones.
- [ ] Backups configured and a restore has been tried once.
- [ ] You have read [SECURITY.md](SECURITY.md), especially "Risks that remain".

## Smoke test

Do this once on the live site, using a throwaway email address for each role.

1. Register a buyer and an owner. Verify both emails.
2. As the owner: create a listing with two photos, submit it for review.
3. As the administrator: open **Moderation**, approve it. The owner should get an email and a bell notification.
4. As a visitor (signed out): search for it, open it, confirm the street address is **not** shown.
5. As the buyer: save it, send a message, request a viewing. The owner gets notifications; confirm the viewing and check the buyer is told.
6. Report the listing as the buyer; resolve the report as the administrator.
7. As the owner: apply for verification with a photo; as the administrator open the document, approve it, and confirm the badge appears and the document can no longer be opened.
8. Change a password in **Settings** and confirm a second browser is signed out.
9. Check `https://YOUR-SITE/sitemap.xml` lists the listing.

## Day-to-day

- **Health:** `GET /api/health`. Point an uptime monitor at it.
- **Logs:** Render's log stream. Look for `AUDIT WRITE FAILED` (an administrator action happened but its audit entry did not save) and `Notification ... failed`.
- **Photo cleanup:** if Cloudinary is unreachable when a photo or document is deleted, the file goes into the `cleanupjobs` collection and is retried every 5 minutes with backoff (up to 8 times). Jobs with `status: "failed"` need a human to look at them.
- **Upgrading from an older copy:** run `npm run sync-indexes`, and (once) `node --env-file=.env scripts/backfillLocationSlugs.js` so listings created before the search feature get their city and neighborhood search keys.
- **More than one API instance:** rate limits are counted in each instance's memory. With several instances, switch the limiter to a shared store (for example Redis) so the limits apply across all of them. One instance is fine to start.

## Backups and recovery

- **Database:** Atlas continuous backup (paid tiers) is the safest option. Otherwise run `MONGODB_URI="..." npm run backup --prefix backend` on a schedule (cron, a CI job) and copy the archive somewhere other than the database host. Restore into an empty test database first:
  `mongorestore --uri "$MONGODB_URI" --gzip --archive=backups/FILE.archive.gz --drop`
- **Photos** live in Cloudinary and are **not** in the database backup. Cloudinary keeps your originals, but enable its backup add-on or periodically export the media library if losing photos would be a serious problem.
- **Verification documents** are deliberately deleted after each decision, so there is nothing to back up for them.
- **After restoring**, run `npm run sync-indexes`.

## Social media previews

Search engines that run JavaScript (Google, Bing) read the page title, description, canonical link and structured data the site sets for each listing. **Social networks and chat apps (WhatsApp, Facebook, X) do not run JavaScript**, so a shared link shows only the generic site title and description, without the listing's photo.

If rich link previews matter, add pre-rendering for `/properties/:slug` and `/agents/:id`: a pre-render service in front of the website, or a small server-side route that returns the page's tags for crawlers. Moving the public pages to a server-rendered framework such as Next.js is the full solution. The data needed (title, price, location, first photo) is available from `GET /api/properties/:slug`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| API exits at start with "Unsafe production configuration" | A setting listed in the message; fix it and redeploy |
| Everyone is signed out immediately / cannot sign in on Safari | The browser is calling the API on another domain; use the forwarding setup |
| "Too many requests" for ordinary visitors | `TRUST_PROXY` is `1` behind a forwarding host; set it to `2` |
| CORS errors in the browser console | `CLIENT_URL` does not exactly match the website's origin (https, no trailing slash) |
| Photos say "not set up on the server yet" | `CLOUDINARY_*` missing or wrong |
| No verification or reset emails | `SMTP_*` missing or wrong; check the API log |
| Search by city finds nothing for old listings | Run the backfill script (see Day-to-day) |
| Duplicate inquiries or reports are possible | Indexes missing; run `npm run sync-indexes` |
