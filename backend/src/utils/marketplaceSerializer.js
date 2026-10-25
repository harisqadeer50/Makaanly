// What each side of a conversation may see. Contact details only ever go to the person they were meant for.
const id = (v) => String(v?._id ?? v);
const plain = (d) => (typeof d?.toObject === 'function' ? d.toObject() : d);
const brief = (u) => (u && u.name ? { id: id(u), name: u.name, avatarUrl: u.avatar?.url || null } : { id: id(u) });

export function serializeInquiry(doc, viewerId) {
  const i = plain(doc);
  const me = String(viewerId);
  const asRecipient = id(i.recipient) === me;
  return {
    id: id(i), status: i.status, viewerRole: asRecipient ? 'recipient' : 'buyer',
    property: { id: id(i.property), title: i.propertyTitle, slug: i.propertySlug },
    message: i.message, phone: i.phone, preferredVisitAt: i.preferredVisitAt,
    // The recipient sees the buyer's name and email; the buyer sees only who they wrote to.
    counterpart: asRecipient ? { ...brief(i.buyer), email: i.buyer?.email } : { ...brief(i.recipient), role: i.recipient?.role },
    replies: (i.replies || []).map((r) => ({ id: id(r), message: r.message, createdAt: r.createdAt, mine: id(r.author) === me })),
    createdAt: i.createdAt, lastActivityAt: i.lastActivityAt,
  };
}

export function serializeAppointment(doc, viewerId) {
  const a = plain(doc);
  const asHost = id(a.host) === String(viewerId);
  return {
    id: id(a), status: a.status, viewerRole: asHost ? 'host' : 'requester',
    property: { id: id(a.property), title: a.propertyTitle, slug: a.propertySlug },
    start: a.requestedStart, end: a.requestedEnd, message: a.message, declineReason: a.declineReason, cancelledBy: a.cancelledBy,
    counterpart: asHost ? { ...brief(a.requester), email: a.requester?.email, phone: a.contactPhone } : { ...brief(a.host), role: a.host?.role },
    createdAt: a.createdAt, updatedAt: a.updatedAt,
  };
}

export function serializeAgent(doc, { listingCount } = {}) {
  const u = plain(doc);
  const p = u.agentProfile || {};
  return {
    id: id(u), name: u.name, avatarUrl: u.avatar?.url || null, isVerified: u.verificationStatus === 'verified',
    agencyName: p.agencyName || null, bio: p.bio || null, serviceAreas: p.serviceAreas || [], specialties: p.specialties || [],
    contactPhone: p.contactPhone || null, contactEmail: p.contactEmail || null, // only what the agent chose to publish
    memberSince: u.createdAt ? new Date(u.createdAt).getUTCFullYear() : null,
    ...(listingCount !== undefined ? { listingCount } : {}),
  };
}
