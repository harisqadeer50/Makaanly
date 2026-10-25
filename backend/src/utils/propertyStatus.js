// The only place that decides which status changes are allowed.
const OWNER = {
  draft: ['pending_review'],
  pending_review: ['draft'], // withdraw
  rejected: ['draft', 'pending_review'],
  published: ['paused', 'sold', 'rented', 'archived'],
  paused: ['published', 'archived'],
  sold: ['archived'],
  rented: ['archived'],
  archived: [],
};
// Admins can do everything owners can, plus moderate and unpublish.
const ADMIN_EXTRA = {
  draft: ['published', 'archived'],
  pending_review: ['published', 'rejected', 'archived'],
  published: ['rejected'],
  paused: ['rejected'],
  rejected: ['archived'],
};

export function allowedTransitions(from, role) {
  const set = new Set(OWNER[from] || []);
  if (role === 'admin') (ADMIN_EXTRA[from] || []).forEach((s) => set.add(s));
  return [...set];
}
export const canTransition = (from, to, role) => allowedTransitions(from, role).includes(to);

// Owners may edit these; sold/rented/archived listings are frozen (admins excepted).
export const OWNER_EDITABLE = Object.freeze(['draft', 'pending_review', 'rejected', 'published', 'paused']);
