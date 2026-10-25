# Security

What protects Makaanly, how to keep it that way, and the risks that remain. Nothing here replaces a professional security review before you handle real customers' data.

## How the requirements are met

| Area | What is done |
| --- | --- |
| **Passwords** | Hashed with bcrypt, never stored or logged in plain text. 8 to 72 characters with a letter and a number. Login timing does not reveal whether an email exists. |
| **Sessions** | Short-lived access token plus a rotating refresh token, in HTTP-only, `Secure` (in production) cookies. Refresh tokens are stored hashed; reusing an old one ends that login. Changing or resetting a password, suspending an account, or "sign out everywhere" revokes sessions, and access tokens issued before a password change stop working. |
| **CSRF** | Every request that changes data needs an `X-CSRF-Token` header matching a cookie. Enforced globally on `/api`. |
| **Authorization** | Enforced on the server for every request: roles, ownership, admin-only routes. Other people's records return 404 (not 403) so ids cannot be probed. An automated test fails if an endpoint is ever added without sign-in unless it is on an explicit public list. The role is never taken from the request; administrators can only be created with a server-side script. |
| **Mass assignment** | Every endpoint accepts only whitelisted fields (Zod schemas strip the rest), so `status`, `owner`, `role`, `isFeatured` and similar cannot be set by a client. |
| **Input** | All input validated on the server (Zod); Mongo operator injection stripped; search text is escaped, never used as a pattern; HTML in emails is escaped; structured data in the page cannot close its own script tag. |
| **Uploads** | JPEG, PNG, WebP (and PDF for verification documents only), 5 MB each, fixed counts. The real file type is checked from the file's bytes, not the declared type. Auth and ownership are checked before the upload is read. |
| **Private documents** | Verification documents are private Cloudinary assets, opened only by administrators through links that expire after 5 minutes; every opening is audited; they are deleted when a decision is made, with retried deletion if Cloudinary is down. |
| **Rate limiting** | General API limit; stricter limits on sign-in and password flows; per-person limits on inquiries, viewing requests, reports and uploads. |
| **Headers and CORS** | Helmet on the API; CORS limited to your exact origins; the website's host adds a content security policy, HSTS, no framing and a restrictive permissions policy (see `frontend/vercel.json`). |
| **Secrets** | Only in environment variables. The API refuses to start in production with a weak secret, a local database, or a non-https origin. `.env` files are git-ignored. |
| **Privacy** | Public pages never show street addresses (unless the owner opts in), emails or phone numbers. Internal moderation notes and report authors are never shown to listers. |
| **Audit** | Administrator actions are written to an audit log with who, what, when and why. |
| **Logging** | Server logs do not include request bodies, passwords or tokens. |
| **Backups** | See [DEPLOYMENT.md](DEPLOYMENT.md#backups-and-recovery). |

## Risks that remain

Read these before launch.

1. **Development-tool advisories.** `npm audit` reports 7 findings in the frontend, all in Tailwind CSS 3's build-time tooling (`braces`, `postcss-selector-parser`). They are not part of what visitors download, and they concern patterns in your own build configuration, not user input. Clearing them needs a major Tailwind 4 migration. The backend and all production dependencies audit clean. CI runs `npm audit --omit=dev` on every push.
2. **Rate limits are per instance.** They are kept in the API's memory. With one instance (the default) that is correct; with several, use a shared store such as Redis.
3. **No account lockout or two-factor sign-in.** Brute-force protection is the per-address rate limit on sign-in. For high-value accounts (administrators), consider adding two-factor authentication.
4. **Audit writes are best-effort.** If the database rejects an audit entry, the administrator action still stands and `AUDIT WRITE FAILED` is logged. Watch for it.
5. **The content security policy allows inline styles** (the interface sets some widths and chart sizes inline). Scripts are restricted to your own files.
6. **Email is only as safe as your provider and domain setup.** Without SPF and DKIM, password-reset emails can be spoofed or filtered.
7. **View counts are approximate** (repeat visits count) and can be inflated by bots.
8. **Not tested in a real browser or against live services.** Automated tests cover the logic and the pages with mocks. Run the [smoke test](DEPLOYMENT.md#smoke-test) on the live site.
9. **Legal text is a template.** Privacy, terms and safety pages must be reviewed by a lawyer.

## Reporting a problem

Publish a contact address for security reports (for example `security@your-domain`) on the support page, and make sure someone reads it.

## Keeping it secure

- Keep dependencies current (`npm audit`, and Dependabot or Renovate on the repository).
- Rotate `JWT_ACCESS_SECRET` if it may have leaked; everyone will be asked to sign in again.
- Review **Admin → Audit log** and the `cleanupjobs` collection (look for `failed`) regularly.
- Give administrator accounts strong, unique passwords, and create as few as you need.
