import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';

// A tiny stand-in for a Mongoose query: chainable, and awaitable.
const chain = (val) => { const q = { select: () => q, populate: () => q, lean: () => q, sort: () => q, skip: () => q, limit: () => q, then: (res, rej) => Promise.resolve(val).then(res, rej) }; return q; };
const m = vi.hoisted(() => ({ Property: {}, User: {}, Inquiry: {}, Appointment: {}, Favorite: {}, Report: {}, notify: vi.fn() }));
vi.mock('../src/services/notification.service.js', () => ({ notify: (...a) => m.notify(...a), excerpt: (s = '', n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s) }));
vi.mock('../src/models/Property.js', () => ({ default: m.Property }));
vi.mock('../src/models/User.js', () => ({ default: m.User }));
vi.mock('../src/models/Inquiry.js', () => ({ default: m.Inquiry }));
vi.mock('../src/models/Appointment.js', () => ({ default: m.Appointment }));
vi.mock('../src/models/Favorite.js', () => ({ default: m.Favorite }));
vi.mock('../src/models/Report.js', () => ({ default: m.Report }));

const rules = await import('../src/utils/appointmentRules.js');
const { canMoveInquiry } = await import('../src/utils/inquiryRules.js');
const { serializeInquiry, serializeAppointment, serializeAgent } = await import('../src/utils/marketplaceSerializer.js');
const v = await import('../src/validators/marketplace.validator.js');
const inquiries = await import('../src/services/inquiry.service.js');
const appts = await import('../src/services/appointment.service.js');
const favorites = await import('../src/services/favorite.service.js');
const reports = await import('../src/services/report.service.js');

// A time in Pakistan (UTC+5), `days` from now.
const at = (days, h, min = 0) => { const d = new Date(Date.now() + days * 86400000); d.setUTCHours(h - 5, min, 0, 0); return d; };
const plus = (d, min) => new Date(d.getTime() + min * 60000);

describe('viewing slots', () => {
  const ok = (s, e) => rules.validateSlot(s, e);
  it('accepts a normal slot, including one that ends exactly at closing time', () => {
    expect(ok(at(3, 10), plus(at(3, 10), 30))).toEqual([]);
    expect(ok(at(3, 19, 30), plus(at(3, 19, 30), 30))).toEqual([]);
    expect(ok(at(3, 9), plus(at(3, 9), 60))).toEqual([]);
  });
  it('enforces viewing hours in Pakistan time', () => {
    expect(ok(at(3, 8, 30), plus(at(3, 8, 30), 30))[0].message).toMatch(/between 9:00 and 20:00/);
    expect(ok(at(3, 19, 45), plus(at(3, 19, 45), 60))[0].message).toMatch(/between 9:00 and 20:00/);
    expect(ok(at(3, 23), plus(at(3, 23), 30))).toHaveLength(1);
  });
  it('requires notice and a sensible horizon', () => {
    const soon = new Date(Date.now() + 30 * 60000);
    expect(ok(soon, plus(soon, 30))[0].message).toMatch(/at least 1 hour/);
    expect(ok(at(61, 10), plus(at(61, 10), 30))[0].message).toMatch(/60 days/);
    expect(ok(at(-1, 10), plus(at(-1, 10), 30))).toHaveLength(1);
  });
  it('rejects odd durations, odd minutes and invalid dates', () => {
    expect(ok(at(3, 10), plus(at(3, 10), 45))[0].message).toMatch(/30 or 60 minutes/);
    expect(ok(at(3, 10, 7), plus(at(3, 10, 7), 30))[0].message).toMatch(/15, 30 or 45/);
    expect(ok(new Date('nope'), new Date('nope'))[0].message).toMatch(/valid date/);
  });
  it('detects overlaps, but not back-to-back viewings', () => {
    const a = { start: at(3, 10), end: at(3, 11) };
    expect(rules.overlaps(a, { start: at(3, 10, 30), end: at(3, 11, 30) })).toBe(true);
    expect(rules.overlaps(a, { start: at(3, 11), end: at(3, 12) })).toBe(false);
    expect(rules.overlaps(a, { start: at(3, 9), end: at(3, 10) })).toBe(false);
  });
});

describe('status rules', () => {
  it('hosts confirm, decline, reschedule and complete; requesters can only accept a new time', () => {
    expect(rules.nextStatus('confirm', 'requested', 'host')).toBe('confirmed');
    expect(rules.nextStatus('confirm', 'confirmed', 'host')).toBeNull();
    expect(rules.nextStatus('confirm', 'requested', 'requester')).toBeNull(); // cannot approve your own request
    expect(rules.nextStatus('reschedule', 'confirmed', 'host')).toBe('rescheduled');
    expect(rules.nextStatus('accept', 'rescheduled', 'requester')).toBe('confirmed');
    expect(rules.nextStatus('accept', 'requested', 'requester')).toBeNull();
    expect(rules.nextStatus('complete', 'requested', 'host')).toBeNull();
    expect(rules.nextStatus('confirm', 'requested', 'stranger')).toBeNull();
  });
  it('only active requests can be cancelled', () => {
    for (const s of ['requested', 'confirmed', 'rescheduled']) expect(rules.canCancel(s)).toBe(true);
    for (const s of ['declined', 'cancelled', 'completed']) expect(rules.canCancel(s)).toBe(false);
  });
  it('inquiries move forward only, and closed is final', () => {
    expect(canMoveInquiry('new', 'read')).toBe(true);
    expect(canMoveInquiry('replied', 'read')).toBe(false);
    expect(canMoveInquiry('closed', 'read')).toBe(false);
    expect(canMoveInquiry('read', 'new')).toBe(false);
  });
});

describe('validators', () => {
  const id = 'a'.repeat(24);
  it('inquiry: needs a real message, and a future visit date if given', () => {
    expect(v.createInquiryBody.safeParse({ propertyId: id, message: 'Is this still available?' }).success).toBe(true);
    expect(v.createInquiryBody.safeParse({ propertyId: id, message: 'hi' }).success).toBe(false);
    expect(v.createInquiryBody.safeParse({ propertyId: id, message: 'Is this still available?', phone: 'abc' }).success).toBe(false);
    expect(v.createInquiryBody.safeParse({ propertyId: id, message: 'Is this still available?', preferredVisitAt: '2020-01-01T10:00:00Z' }).success).toBe(false);
    expect(v.createInquiryBody.safeParse({ propertyId: id, message: 'Is this still available?', recipient: 'attacker' }).data).not.toHaveProperty('recipient'); // never trusted
  });
  it('appointment: ISO start, 30 or 60 minutes, strips fields the client must not set', () => {
    const r = v.createAppointmentBody.parse({ propertyId: id, start: '2030-01-01T05:00:00Z', host: 'x', status: 'confirmed' });
    expect(r.start).toBeInstanceOf(Date); expect(r.durationMinutes).toBe(30);
    expect(r).not.toHaveProperty('host'); expect(r).not.toHaveProperty('status');
    expect(v.createAppointmentBody.safeParse({ propertyId: id, start: 'tomorrow' }).success).toBe(false);
    expect(v.createAppointmentBody.safeParse({ propertyId: id, start: '2030-01-01T05:00:00Z', durationMinutes: 45 }).success).toBe(false);
  });
  it('appointment action: reschedule needs a new time', () => {
    expect(v.appointmentActionBody.safeParse({ action: 'reschedule' }).success).toBe(false);
    expect(v.appointmentActionBody.safeParse({ action: 'reschedule', start: '2030-01-01T05:00:00Z' }).success).toBe(true);
    expect(v.appointmentActionBody.safeParse({ action: 'delete' }).success).toBe(false);
  });
  it('report: "other" needs a description', () => {
    expect(v.reportBody.safeParse({ reason: 'fake_listing' }).success).toBe(true);
    expect(v.reportBody.safeParse({ reason: 'other' }).success).toBe(false);
    expect(v.reportBody.safeParse({ reason: 'other', description: 'The photos are of another house' }).success).toBe(true);
    expect(v.reportBody.safeParse({ reason: 'spam' }).success).toBe(false);
  });
  it('agent profile: bio required, lists de-duplicated, only known specialties', () => {
    const r = v.agentProfileBody.parse({ bio: 'Ten years selling homes in Lahore.', serviceAreas: ['DHA', 'DHA', 'Gulberg'], specialties: ['house', 'house'] });
    expect(r.serviceAreas).toEqual(['DHA', 'Gulberg']); expect(r.specialties).toEqual(['house']);
    expect(v.agentProfileBody.safeParse({ bio: 'short' }).success).toBe(false);
    expect(v.agentProfileBody.safeParse({ bio: 'Ten years selling homes in Lahore.', specialties: ['castle'] }).success).toBe(false);
    expect(v.agentProfileBody.parse({ bio: 'Ten years selling homes in Lahore.', contactPhone: '' }).contactPhone).toBeUndefined();
  });
  it('profile update ignores role and email', () => {
    const r = v.userUpdateBody.parse({ name: 'New Name', role: 'admin', email: 'x@y.z' });
    expect(r).toEqual({ name: 'New Name' });
  });
});

describe('serializers keep contact details with the right person', () => {
  const inquiry = { _id: 'i1', status: 'new', property: 'p1', propertyTitle: 'T', propertySlug: 's', message: 'Hello there', phone: '0300 1112223', createdAt: 1,
    buyer: { _id: 'b1', name: 'Buyer', email: 'buyer@x.com' }, recipient: { _id: 'r1', name: 'Lister', role: 'agent', email: 'lister@x.com', phone: '0399' }, replies: [{ _id: 'x', author: 'r1', message: 'Yes' }] };
  it('lister sees the buyer, buyer does not get the lister\'s email or phone', () => {
    const forRecipient = serializeInquiry(inquiry, 'r1');
    expect(forRecipient.counterpart).toMatchObject({ name: 'Buyer', email: 'buyer@x.com' });
    expect(forRecipient.viewerRole).toBe('recipient');
    const forBuyer = serializeInquiry(inquiry, 'b1');
    expect(forBuyer.viewerRole).toBe('buyer');
    expect(JSON.stringify(forBuyer)).not.toMatch(/lister@x\.com|0399/);
    expect(forBuyer.replies[0].mine).toBe(false); expect(forRecipient.replies[0].mine).toBe(true);
  });
  it('appointments: the host sees the requester\'s phone, the requester sees only the host\'s name', () => {
    const a = { _id: 'a1', status: 'requested', property: 'p1', propertyTitle: 'T', propertySlug: 's', requestedStart: 1, requestedEnd: 2, contactPhone: '0300 1112223',
      host: { _id: 'h1', name: 'Host', role: 'owner', email: 'host@x.com', phone: '0311' }, requester: { _id: 'q1', name: 'Req', email: 'req@x.com' } };
    expect(serializeAppointment(a, 'h1').counterpart).toMatchObject({ name: 'Req', phone: '0300 1112223', email: 'req@x.com' });
    expect(JSON.stringify(serializeAppointment(a, 'q1'))).not.toMatch(/host@x\.com|0311/);
  });
  it('agent profile publishes only what the agent chose to share', () => {
    const agent = { _id: 'g1', name: 'Agent', email: 'private@x.com', phone: '0300', passwordHash: 'x', verificationStatus: 'verified', createdAt: '2024-05-01', agentProfile: { bio: 'Hi there', contactPhone: '0312', specialties: ['house'] } };
    const out = serializeAgent(agent, { listingCount: 3 });
    expect(out).toMatchObject({ name: 'Agent', isVerified: true, contactPhone: '0312', contactEmail: null, listingCount: 3, memberSince: 2024 });
    expect(JSON.stringify(out)).not.toMatch(/private@x\.com|0300|passwordHash/);
  });
});

describe('inquiry service', () => {
  const buyer = { _id: 'buyer1' };
  const prop = (over = {}) => ({ _id: 'p1', title: 'House', slug: 'house-1', owner: 'owner1', status: 'published', ...over });
  beforeEach(() => {
    Object.assign(m.Property, { findOne: vi.fn(() => chain(prop())) });
    Object.assign(m.User, { findOne: vi.fn(() => chain({ _id: 'owner1' })) });
    Object.assign(m.Inquiry, { findOne: vi.fn(() => chain(null)), create: vi.fn(async (d) => ({ _id: 'i1', ...d })) });
  });

  it('sends to the owner, derived from the listing', async () => {
    await inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' });
    expect(m.Inquiry.create.mock.calls[0][0]).toMatchObject({ recipient: 'owner1', buyer: 'buyer1', propertyTitle: 'House', propertySlug: 'house-1' });
  });
  it('prefers the assigned agent over the owner', async () => {
    m.Property.findOne.mockReturnValue(chain(prop({ assignedAgent: 'agent1' })));
    m.User.findOne.mockReturnValue(chain({ _id: 'agent1' }));
    await inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' });
    expect(m.User.findOne.mock.calls[0][0]._id).toBe('agent1');
    expect(m.Inquiry.create.mock.calls[0][0].recipient).toBe('agent1');
  });
  it('refuses unpublished listings, own listings and unavailable listers', async () => {
    m.Property.findOne.mockReturnValue(chain(null));
    await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).rejects.toMatchObject({ status: 404 });
    m.Property.findOne.mockReturnValue(chain(prop({ owner: 'buyer1' })));
    await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).rejects.toMatchObject({ status: 403 });
    m.Property.findOne.mockReturnValue(chain(prop({ assignedAgent: 'buyer1' })));
    await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).rejects.toMatchObject({ status: 403 });
    m.Property.findOne.mockReturnValue(chain(prop()));
    m.User.findOne.mockReturnValue(chain(null));
    await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).rejects.toMatchObject({ code: 'LISTER_UNAVAILABLE' });
  });
  it('allows only one open conversation per listing, including when two requests race', async () => {
    m.Inquiry.findOne.mockReturnValue(chain({ _id: 'existing' }));
    await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).rejects.toMatchObject({ status: 409, code: 'INQUIRY_EXISTS', details: [{ field: 'inquiryId', message: 'existing' }] });
    m.Inquiry.findOne.mockReturnValue(chain(null));
    m.Inquiry.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).rejects.toMatchObject({ code: 'INQUIRY_EXISTS' });
  });

  describe('conversation', () => {
    const conv = (over = {}) => ({ _id: 'i1', status: 'new', property: 'p1', propertyTitle: 'T', propertySlug: 's', message: 'Hello there', replies: [], save: vi.fn(async () => {}),
      buyer: { _id: 'buyer1', name: 'B', email: 'b@x.com' }, recipient: { _id: 'rec1', name: 'R', role: 'owner' }, ...over });
    it('opening marks it read for the lister only', async () => {
      const c = conv(); m.Inquiry.findOne.mockReturnValue(chain(c));
      await inquiries.getInquiry('i1', { _id: 'buyer1' }); expect(c.status).toBe('new');
      await inquiries.getInquiry('i1', { _id: 'rec1' }); expect(c.status).toBe('read');
    });
    it('is invisible to anyone else (the lookup requires being a participant)', async () => {
      m.Inquiry.findOne.mockReturnValue(chain(null));
      await expect(inquiries.getInquiry('i1', { _id: 'stranger' })).rejects.toMatchObject({ status: 404 });
      expect(m.Inquiry.findOne.mock.calls[0][0].$or).toEqual([{ buyer: 'stranger' }, { recipient: 'stranger' }]);
    });
    it('a lister reply marks it replied; the buyer may only close', async () => {
      const c = conv(); m.Inquiry.findOne.mockReturnValue(chain(c));
      await inquiries.addReply('i1', { _id: 'rec1' }, 'Yes it is');
      expect(c.status).toBe('replied'); expect(c.replies).toHaveLength(1);
      await expect(inquiries.setStatus('i1', { _id: 'buyer1' }, 'replied')).rejects.toMatchObject({ status: 403 });
      await expect(inquiries.setStatus('i1', { _id: 'buyer1' }, 'closed')).resolves.toBeTruthy();
      await expect(inquiries.addReply('i1', { _id: 'rec1' }, 'More')).rejects.toMatchObject({ status: 409 }); // closed
    });
    it('caps the length of a conversation', async () => {
      m.Inquiry.findOne.mockReturnValue(chain(conv({ replies: Array.from({ length: 50 }, (_, i) => ({ _id: i, author: 'x', message: 'm' })) })));
      await expect(inquiries.addReply('i1', { _id: 'buyer1' }, 'one more')).rejects.toMatchObject({ status: 409 });
    });
  });
});

describe('appointment service', () => {
  const requester = { _id: 'req1' };
  const start = () => at(3, 10);
  const body = () => ({ propertyId: 'p1', start: start(), durationMinutes: 30, message: 'hi', phone: '0300 1112223' });
  beforeEach(() => {
    Object.assign(m.Property, { findOne: vi.fn(() => chain({ _id: 'p1', title: 'House', slug: 'h-1', owner: 'owner1', status: 'published' })) });
    Object.assign(m.User, { exists: vi.fn(async () => true) });
    Object.assign(m.Appointment, {
      exists: vi.fn(async () => null), countDocuments: vi.fn(async () => 0), findOne: vi.fn(() => chain(null)), create: vi.fn(async (d) => ({ _id: 'a1', ...d })),
    });
  });

  it('creates a request with the host taken from the listing and the end time computed on the server', async () => {
    await appts.createAppointment(requester, { ...body(), durationMinutes: 60 });
    const doc = m.Appointment.create.mock.calls[0][0];
    expect(doc).toMatchObject({ host: 'owner1', requester: 'req1', propertySlug: 'h-1' });
    expect(doc.requestedEnd - doc.requestedStart).toBe(60 * 60000);
  });
  it('rejects bad times, own listings, duplicates and taken slots', async () => {
    await expect(appts.createAppointment(requester, { ...body(), start: at(3, 7) })).rejects.toMatchObject({ status: 422 });
    m.Property.findOne.mockReturnValue(chain({ _id: 'p1', title: 'x', slug: 'x', owner: 'req1', status: 'published' }));
    await expect(appts.createAppointment(requester, body())).rejects.toMatchObject({ status: 403 });
    m.Property.findOne.mockReturnValue(chain({ _id: 'p1', title: 'x', slug: 'x', owner: 'owner1', status: 'published' }));
    m.Appointment.exists.mockResolvedValue({ _id: 'x' });
    await expect(appts.createAppointment(requester, body())).rejects.toMatchObject({ code: 'APPOINTMENT_EXISTS' });
    m.Appointment.exists.mockResolvedValue(null);
    m.Appointment.countDocuments.mockResolvedValue(10);
    await expect(appts.createAppointment(requester, body())).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    m.Appointment.countDocuments.mockResolvedValue(0);
    m.Appointment.findOne.mockReturnValue(chain({ _id: 'busy' }));
    await expect(appts.createAppointment(requester, body())).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
  });
  it('looks for overlapping confirmed viewings for the host, across all their listings', async () => {
    await appts.createAppointment(requester, body());
    const q = m.Appointment.findOne.mock.calls[0][0];
    expect(q).toMatchObject({ host: 'owner1', status: 'confirmed' });
    expect(q.requestedStart.$lt).toBeInstanceOf(Date); expect(q.requestedEnd.$gt).toBeInstanceOf(Date);
  });

  describe('acting on a request', () => {
    const appt = (over = {}) => ({ _id: 'a1', host: 'owner1', requester: 'req1', status: 'requested', requestedStart: at(3, 10), requestedEnd: at(3, 10, 30),
      save: vi.fn(async () => {}), populate: vi.fn(async () => {}), propertyTitle: 'T', propertySlug: 's', property: 'p1', ...over });
    const host = { _id: 'owner1' };

    it('host confirms when the time is free', async () => {
      const a = appt(); m.Appointment.findOne.mockReturnValueOnce(chain(a)).mockReturnValue(chain(null));
      const out = await appts.act('a1', host, { action: 'confirm' });
      expect(a.status).toBe('confirmed'); expect(a.confirmedAt).toBeInstanceOf(Date); expect(out.status).toBe('confirmed');
    });
    it('host cannot confirm over another confirmed viewing', async () => {
      const a = appt(); m.Appointment.findOne.mockReturnValueOnce(chain(a)).mockReturnValueOnce(chain({ _id: 'other' }));
      await expect(appts.act('a1', host, { action: 'confirm' })).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
      expect(a.status).toBe('requested'); expect(a.save).not.toHaveBeenCalled();
    });
    it('steps back if a simultaneous confirmation won the race', async () => {
      const a = appt(); // 1st lookup: the appointment; 2nd: no conflict yet; 3rd (after saving): an earlier confirmation exists
      m.Appointment.findOne.mockReturnValueOnce(chain(a)).mockReturnValueOnce(chain(null)).mockReturnValueOnce(chain({ _id: 'rival' }));
      await expect(appts.act('a1', host, { action: 'confirm' })).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
      expect(a.status).toBe('requested'); expect(a.confirmedAt).toBeUndefined(); expect(a.save).toHaveBeenCalledTimes(2);
    });
    it('the requester cannot confirm their own request, and strangers cannot see it', async () => {
      m.Appointment.findOne.mockReturnValueOnce(chain(appt()));
      await expect(appts.act('a1', { _id: 'req1' }, { action: 'confirm' })).rejects.toMatchObject({ status: 403 });
      m.Appointment.findOne.mockReturnValueOnce(chain(null));
      await expect(appts.act('a1', { _id: 'stranger' }, { action: 'confirm' })).rejects.toMatchObject({ status: 404 });
      expect(m.Appointment.findOne.mock.calls.at(-1)[0].$or).toEqual([{ host: 'stranger' }, { requester: 'stranger' }]);
    });
    it('host proposes a new time, which the requester then accepts', async () => {
      const a = appt({ status: 'confirmed' }); m.Appointment.findOne.mockReturnValueOnce(chain(a)).mockReturnValue(chain(null));
      await appts.act('a1', host, { action: 'reschedule', start: at(4, 15) });
      expect(a.status).toBe('rescheduled'); expect(a.requestedStart.getTime()).toBe(at(4, 15).getTime());
      m.Appointment.findOne.mockReturnValueOnce(chain(a)).mockReturnValue(chain(null));
      await appts.act('a1', { _id: 'req1' }, { action: 'accept' });
      expect(a.status).toBe('confirmed');
    });
    it('rejects a reschedule outside viewing hours or onto a taken slot', async () => {
      m.Appointment.findOne.mockReturnValueOnce(chain(appt()));
      await expect(appts.act('a1', host, { action: 'reschedule', start: at(4, 22) })).rejects.toMatchObject({ status: 422 });
      m.Appointment.findOne.mockReturnValueOnce(chain(appt())).mockReturnValueOnce(chain({ _id: 'busy' }));
      await expect(appts.act('a1', host, { action: 'reschedule', start: at(4, 15) })).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
    });
    it('a viewing can be completed only after it has finished', async () => {
      m.Appointment.findOne.mockReturnValueOnce(chain(appt({ status: 'confirmed' })));
      await expect(appts.act('a1', host, { action: 'complete' })).rejects.toMatchObject({ status: 409 });
      const done = appt({ status: 'confirmed', requestedStart: at(-1, 10), requestedEnd: at(-1, 10, 30) });
      m.Appointment.findOne.mockReturnValueOnce(chain(done));
      await appts.act('a1', host, { action: 'complete' });
      expect(done.status).toBe('completed');
    });
    it('either side can cancel an active request; finished ones cannot be cancelled', async () => {
      const a = appt({ status: 'confirmed' }); m.Appointment.findOne.mockReturnValueOnce(chain(a));
      await appts.cancel('a1', { _id: 'req1' }, 'Plans changed');
      expect(a).toMatchObject({ status: 'cancelled', cancelledBy: 'requester' });
      m.Appointment.findOne.mockReturnValueOnce(chain(appt({ status: 'declined' })));
      await expect(appts.cancel('a1', host)).rejects.toMatchObject({ status: 409 });
    });
  });
});

describe('favorites and reports', () => {
  beforeEach(() => {
    Object.assign(m.Property, { exists: vi.fn(async () => ({ _id: 'p1' })), findOne: vi.fn(() => chain({ _id: 'p1', title: 'T', owner: 'owner1' })) });
    Object.assign(m.Favorite, { countDocuments: vi.fn(async () => 0), exists: vi.fn(async () => null), updateOne: vi.fn(async () => ({})), deleteOne: vi.fn(async () => ({})) });
    Object.assign(m.Report, { exists: vi.fn(async () => null), create: vi.fn(async () => ({})) });
  });
  it('saving is idempotent (an upsert), and only works for published listings', async () => {
    await favorites.addFavorite({ _id: 'u1' }, 'p1'); await favorites.addFavorite({ _id: 'u1' }, 'p1');
    expect(m.Favorite.updateOne.mock.calls[0][2]).toEqual({ upsert: true });
    expect(m.Property.exists.mock.calls[0][0]).toEqual({ _id: 'p1', status: 'published' });
    m.Property.exists.mockResolvedValue(null);
    await expect(favorites.addFavorite({ _id: 'u1' }, 'p1')).rejects.toMatchObject({ status: 404 });
  });
  it('enforces the cap for new saves but not for one already saved', async () => {
    m.Favorite.countDocuments.mockResolvedValue(200);
    await expect(favorites.addFavorite({ _id: 'u1' }, 'p1')).rejects.toMatchObject({ status: 409 });
    m.Favorite.exists.mockResolvedValue({ _id: 'f' });
    await expect(favorites.addFavorite({ _id: 'u1' }, 'p1')).resolves.toEqual({ saved: true });
  });
  it('removing only touches the current user\'s own record', async () => {
    await favorites.removeFavorite({ _id: 'u1' }, 'p1');
    expect(m.Favorite.deleteOne).toHaveBeenCalledWith({ user: 'u1', property: 'p1' });
  });
  it('reports: not your own listing, not twice, and a race is handled', async () => {
    await expect(reports.createReport({ _id: 'u1' }, 'p1', { reason: 'fake_listing' })).resolves.toEqual({ reported: true });
    m.Property.findOne.mockReturnValue(chain({ _id: 'p1', title: 'T', owner: 'u1' }));
    await expect(reports.createReport({ _id: 'u1' }, 'p1', { reason: 'fake_listing' })).rejects.toMatchObject({ status: 403 });
    m.Property.findOne.mockReturnValue(chain({ _id: 'p1', title: 'T', owner: 'owner1' }));
    m.Report.exists.mockResolvedValue({ _id: 'r' });
    await expect(reports.createReport({ _id: 'u2' }, 'p1', { reason: 'fake_listing' })).rejects.toMatchObject({ code: 'ALREADY_REPORTED' });
    m.Report.exists.mockResolvedValue(null);
    m.Report.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(reports.createReport({ _id: 'u2' }, 'p1', { reason: 'fake_listing' })).rejects.toMatchObject({ code: 'ALREADY_REPORTED' });
  });
});


describe('notifications are sent to the right person, without slowing the request down', () => {
  beforeEach(() => { m.notify.mockReset(); });
  const buyer = { _id: 'buyer1', name: 'Sam Buyer' };

  describe('inquiries', () => {
    const setup = (propOver = {}, recipientId = 'owner1') => {
      Object.assign(m.Property, { findOne: vi.fn(() => chain({ _id: 'p1', title: 'House', slug: 'house-1', owner: 'owner1', status: 'published', ...propOver })) });
      Object.assign(m.User, { findOne: vi.fn(() => chain({ _id: recipientId })) });
      Object.assign(m.Inquiry, { findOne: vi.fn(() => chain(null)), create: vi.fn(async (d) => ({ _id: 'i1', ...d })) });
    };
    it('a new inquiry tells the lister, with an email and a link to the conversation', async () => {
      setup();
      await inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' });
      expect(m.notify).toHaveBeenCalledWith('owner1', expect.objectContaining({ type: 'inquiry.new', email: true, link: '/dashboard/inquiries/i1', title: 'New inquiry about House', body: 'Is this still available?' }));
    });
    it('goes to the assigned agent when there is one', async () => {
      setup({ assignedAgent: 'agent1' }, 'agent1');
      await inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' });
      expect(m.notify.mock.calls[0][0]).toBe('agent1');
    });
    it('does not notify anyone when the inquiry is refused', async () => {
      setup({ owner: 'buyer1' });
      await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).rejects.toMatchObject({ status: 403 });
      setup(); m.Inquiry.findOne.mockReturnValue(chain({ _id: 'existing' }));
      await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).rejects.toMatchObject({ code: 'INQUIRY_EXISTS' });
      expect(m.notify).not.toHaveBeenCalled();
    });
    it('does not wait for the notification (a slow email must not slow the request)', async () => {
      setup(); m.notify.mockReturnValue(new Promise(() => {})); // never finishes
      await expect(inquiries.createInquiry(buyer, { propertyId: 'p1', message: 'Is this still available?' })).resolves.toBeTruthy();
    });
    it('a reply tells the other person, and emails at most once while the last one is unread', async () => {
      const conv = () => ({ _id: 'i1', status: 'read', property: 'p1', propertyTitle: 'House', propertySlug: 's', message: 'Hello there', replies: [], save: vi.fn(async () => {}), buyer: { _id: 'buyer1', name: 'B', email: 'b@x.com' }, recipient: { _id: 'rec1', name: 'R', role: 'owner' } });
      m.Inquiry.findOne = vi.fn(() => chain(conv()));
      await inquiries.addReply('i1', { _id: 'rec1' }, 'Yes it is');
      expect(m.notify).toHaveBeenLastCalledWith('buyer1', expect.objectContaining({ type: 'inquiry.reply', email: true, emailUnlessUnread: true, link: '/dashboard/inquiries/i1', body: 'Yes it is' }));
      await inquiries.addReply('i1', { _id: 'buyer1' }, 'Thanks, can I visit?');
      expect(m.notify).toHaveBeenLastCalledWith('rec1', expect.objectContaining({ type: 'inquiry.reply' }));
    });
  });

  describe('viewings', () => {
    const appt = (over = {}) => ({ _id: 'a1', host: 'owner1', requester: 'req1', status: 'requested', requestedStart: at(3, 10), requestedEnd: at(3, 10, 30), propertyTitle: 'House', property: 'p1', propertySlug: 's',
      save: vi.fn(async () => {}), populate: vi.fn(async () => {}), ...over });
    beforeEach(() => { m.Appointment.findOne = vi.fn(() => chain(null)); });

    it('a request tells the host who wants to visit and when, in Pakistan time', async () => {
      Object.assign(m.Property, { findOne: vi.fn(() => chain({ _id: 'p1', title: 'House', slug: 'h-1', owner: 'owner1', status: 'published' })) });
      Object.assign(m.User, { exists: vi.fn(async () => true) });
      Object.assign(m.Appointment, { exists: vi.fn(async () => null), countDocuments: vi.fn(async () => 0), findOne: vi.fn(() => chain(null)), create: vi.fn(async (d) => ({ _id: 'a1', ...d })) });
      await appts.createAppointment(buyer, { propertyId: 'p1', start: at(3, 10), durationMinutes: 30 });
      expect(m.notify).toHaveBeenCalledWith('owner1', expect.objectContaining({ type: 'appointment.requested', email: true, link: '/dashboard/appointments' }));
      expect(m.notify.mock.calls[0][1].body).toMatch(/Sam Buyer would like to visit on .*10:00 am \(Pakistan time\)/);
    });
    it('the host confirming tells the requester; the requester accepting a new time tells the host', async () => {
      m.Appointment.findOne.mockReturnValueOnce(chain(appt())).mockReturnValue(chain(null));
      await appts.act('a1', { _id: 'owner1' }, { action: 'confirm' });
      expect(m.notify).toHaveBeenLastCalledWith('req1', expect.objectContaining({ type: 'appointment.confirmed', link: '/dashboard/appointments?tab=mine', email: true }));
      m.Appointment.findOne.mockReturnValueOnce(chain(appt({ status: 'rescheduled' }))).mockReturnValue(chain(null));
      await appts.act('a1', { _id: 'req1' }, { action: 'accept' });
      expect(m.notify).toHaveBeenLastCalledWith('owner1', expect.objectContaining({ type: 'appointment.confirmed', link: '/dashboard/appointments' }));
    });
    it('declining and proposing a new time tell the requester, including the reason', async () => {
      m.Appointment.findOne.mockReturnValueOnce(chain(appt()));
      await appts.act('a1', { _id: 'owner1' }, { action: 'decline', reason: 'Not available that week' });
      expect(m.notify).toHaveBeenLastCalledWith('req1', expect.objectContaining({ type: 'appointment.declined' }));
      expect(m.notify.mock.calls.at(-1)[1].body).toContain('Not available that week');
      m.Appointment.findOne.mockReturnValueOnce(chain(appt())).mockReturnValue(chain(null));
      await appts.act('a1', { _id: 'owner1' }, { action: 'reschedule', start: at(4, 15) });
      expect(m.notify).toHaveBeenLastCalledWith('req1', expect.objectContaining({ type: 'appointment.rescheduled' }));
    });
    it('cancelling tells the other side only', async () => {
      m.Appointment.findOne.mockReturnValueOnce(chain(appt({ status: 'confirmed' })));
      await appts.cancel('a1', { _id: 'req1' }, 'Plans changed');
      expect(m.notify).toHaveBeenCalledTimes(1); expect(m.notify).toHaveBeenLastCalledWith('owner1', expect.objectContaining({ type: 'appointment.cancelled' }));
      m.Appointment.findOne.mockReturnValueOnce(chain(appt({ status: 'requested' })));
      await appts.cancel('a1', { _id: 'owner1' });
      expect(m.notify).toHaveBeenLastCalledWith('req1', expect.objectContaining({ type: 'appointment.cancelled', link: '/dashboard/appointments?tab=mine' }));
    });
    it('sends nothing when the change is refused', async () => {
      m.Appointment.findOne.mockReturnValueOnce(chain(appt({ status: 'declined' })));
      await expect(appts.act('a1', { _id: 'owner1' }, { action: 'confirm' })).rejects.toMatchObject({ status: 409 });
      expect(m.notify).not.toHaveBeenCalled();
    });
  });
});
