# API reference

Generated from the running router by `npm run docs:api` (79 endpoints). Do not edit by hand.

**Conventions.** Every response is JSON: `{ "success": true, "data": ..., "meta": ... }` or `{ "success": false, "code": "...", "message": "...", "errors": [{ "field", "message" }] }`.
Lists accept `page` and `limit` and return `meta.total` and `meta.totalPages`. Requests that change data need the `X-CSRF-Token` header (get it from `GET /api/auth/csrf`) and the sign-in cookies.
"Signed in" endpoints may be limited further by role (owner, agent, administrator) or to the person's own records; the server enforces this on every request. Other people's records return 404, not 403.

## /api/admin

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/admin/audit-logs` | Administrator |
| GET | `/api/admin/categories` | Administrator |
| PATCH | `/api/admin/categories/:key` | Administrator |
| GET | `/api/admin/dashboard` | Administrator |
| GET | `/api/admin/properties` | Administrator |
| PATCH | `/api/admin/properties/:id/featured` | Administrator |
| PATCH | `/api/admin/properties/:id/moderation` | Administrator |
| GET | `/api/admin/properties/pending` | Administrator |
| GET | `/api/admin/reports` | Administrator |
| PATCH | `/api/admin/reports/:id` | Administrator |
| GET | `/api/admin/users` | Administrator |
| GET | `/api/admin/users/:id` | Administrator |
| PATCH | `/api/admin/users/:id/status` | Administrator |
| GET | `/api/admin/verifications` | Administrator |
| PATCH | `/api/admin/verifications/:id` | Administrator |
| GET | `/api/admin/verifications/:id/documents/:docId` | Administrator |

## /api/agents

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/agents` | Public |
| GET | `/api/agents/:id` | Public |
| PATCH | `/api/agents/me/profile` | Signed in |
| POST | `/api/agents/me/verification` | Signed in, verified email |
| GET | `/api/agents/me/verification/me` | Signed in |

## /api/appointments

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/appointments` | Signed in, verified email |
| PATCH | `/api/appointments/:id` | Signed in |
| PATCH | `/api/appointments/:id/cancel` | Signed in |
| GET | `/api/appointments/mine` | Signed in |
| GET | `/api/appointments/received` | Signed in |

## /api/auth

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/change-password` | Signed in |
| GET | `/api/auth/csrf` | Public |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Public |
| POST | `/api/auth/logout-all` | Signed in |
| GET | `/api/auth/me` | Signed in |
| POST | `/api/auth/refresh` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/resend-verification` | Signed in |
| POST | `/api/auth/reset-password` | Public |
| POST | `/api/auth/verify-email` | Public |

## /api/categories

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/categories` | Public |

## /api/dashboard

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/dashboard/summary` | Signed in |

## /api/favorites

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/favorites` | Signed in |
| POST | `/api/favorites/:propertyId` | Signed in |
| DELETE | `/api/favorites/:propertyId` | Signed in |
| GET | `/api/favorites/ids` | Signed in |

## /api/health

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/health` | Public |

## /api/inquiries

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/inquiries` | Signed in, verified email |
| GET | `/api/inquiries/:id` | Signed in |
| POST | `/api/inquiries/:id/replies` | Signed in |
| PATCH | `/api/inquiries/:id/status` | Signed in |
| GET | `/api/inquiries/received` | Signed in |
| GET | `/api/inquiries/sent` | Signed in |

## /api/notifications

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/notifications` | Signed in |
| PATCH | `/api/notifications/:id/read` | Signed in |
| POST | `/api/notifications/read-all` | Signed in |
| GET | `/api/notifications/unread-count` | Signed in |

## /api/properties

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/properties` | Public |
| POST | `/api/properties` | Signed in, verified email |
| PATCH | `/api/properties/:id` | Signed in |
| DELETE | `/api/properties/:id` | Signed in |
| POST | `/api/properties/:id/images` | Signed in |
| PATCH | `/api/properties/:id/images` | Signed in |
| PUT | `/api/properties/:id/images/:imageId` | Signed in |
| DELETE | `/api/properties/:id/images/:imageId` | Signed in |
| POST | `/api/properties/:id/report` | Signed in, verified email |
| PATCH | `/api/properties/:id/status` | Signed in |
| GET | `/api/properties/:idOrSlug` | Public (sees more if signed in) |
| GET | `/api/properties/:idOrSlug/similar` | Public |
| GET | `/api/properties/locations` | Public |
| GET | `/api/properties/mine` | Signed in |
| GET | `/api/properties/mine/:id` | Signed in |
| GET | `/api/properties/mine/summary` | Signed in |

## /api/users

| Method | Path | Access |
| --- | --- | --- |
| PATCH | `/api/users/me` | Signed in |
| PUT | `/api/users/me/avatar` | Signed in |
| DELETE | `/api/users/me/avatar` | Signed in |
| PATCH | `/api/users/me/preferences` | Signed in |

## /api/verification

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/verification` | Signed in, verified email |
| GET | `/api/verification/me` | Signed in |

## Site files

| Method | Path | Access |
| --- | --- | --- |
| GET | `/robots.txt` | Public |
| GET | `/sitemap.xml` | Public |

