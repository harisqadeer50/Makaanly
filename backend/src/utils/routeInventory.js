import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { requireVerified } from '../middleware/authenticate.js';
import { requireVerifiedUnlessAdmin } from '../middleware/propertyAccess.js';

// Reads every route from a live Express app and works out whether it needs sign-in, by comparing the real middleware functions
// (not their names). Used by the API documentation and by the test that guards against accidentally public endpoints.
const mount = (layer) => (layer.regexp?.fast_slash ? '' : layer.regexp.source.replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/'));
const VERIFIED = [requireVerified, requireVerifiedUnlessAdmin];

export function inventory(app) {
  const rows = [];
  const walk = (stack, prefix, inherited) => {
    let scope = [...inherited]; // middleware declared on the router itself applies to every route below it
    for (const layer of stack) {
      if (layer.route) {
        const fns = [...scope, ...layer.route.stack.map((l) => l.handle)];
        const auth = fns.includes(authenticate) ? 'required' : fns.includes(optionalAuth) ? 'optional' : 'none';
        const path = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}` || '/';
        for (const method of Object.keys(layer.route.methods)) rows.push({ method: method.toUpperCase(), path, auth, verifiedEmail: fns.some((f) => VERIFIED.includes(f)), admin: prefix.startsWith('/api/admin') });
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack, prefix + mount(layer), scope);
      } else {
        scope = [...scope, layer.handle];
      }
    }
  };
  walk(app._router.stack, '', []);
  return rows;
}

export const accessLabel = (r) => (r.admin ? 'Administrator' : r.auth === 'required' ? (r.verifiedEmail ? 'Signed in, verified email' : 'Signed in') : r.auth === 'optional' ? 'Public (sees more if signed in)' : 'Public');
