// Prints every API route as a Markdown table, read from the live Express router, so the documentation cannot drift from the code.
//   node scripts/listRoutes.js > ../docs/API.md          (npm run docs:api)
import { createApp } from '../src/app.js';
import { inventory, accessLabel } from '../src/utils/routeInventory.js';

const app = createApp();
const rows = inventory(app).map((r) => ({ ...r, access: accessLabel(r) }));

const order = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };
rows.sort((a, b) => a.path.localeCompare(b.path) || order[a.method] - order[b.method]);
const group = (p) => (p.startsWith('/api/') ? `/api/${p.split('/')[2]}` : 'Site files');
const groups = new Map();
rows.forEach((r) => { const g = group(r.path); groups.set(g, [...(groups.get(g) || []), r]); });

console.log(`# API reference

Generated from the running router by \`npm run docs:api\` (${rows.length} endpoints). Do not edit by hand.

**Conventions.** Every response is JSON: \`{ "success": true, "data": ..., "meta": ... }\` or \`{ "success": false, "code": "...", "message": "...", "errors": [{ "field", "message" }] }\`.
Lists accept \`page\` and \`limit\` and return \`meta.total\` and \`meta.totalPages\`. Requests that change data need the \`X-CSRF-Token\` header (get it from \`GET /api/auth/csrf\`) and the sign-in cookies.
"Signed in" endpoints may be limited further by role (owner, agent, administrator) or to the person's own records; the server enforces this on every request. Other people's records return 404, not 403.
`);
for (const [name, list] of groups) {
  console.log(`## ${name}\n\n| Method | Path | Access |\n| --- | --- | --- |`);
  list.forEach((r) => console.log(`| ${r.method} | \`${r.path}\` | ${r.access} |`));
  console.log('');
}
