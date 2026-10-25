import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'test';

const chain = (val) => { const q = { select: () => q, populate: () => q, lean: () => q, sort: () => q, skip: () => q, limit: () => q, then: (res, rej) => Promise.resolve(val).then(res, rej) }; return q; };
const m = vi.hoisted(() => ({ notify: vi.fn(), User: {}, Property: {}, Report: {}, RefreshToken: {}, VerificationRequest: {}, Category: {}, AuditLog: {}, changeStatus: vi.fn(), audit: vi.fn(), email: vi.fn(), listingEmail: vi.fn(),
  cloud: { configured: true, upload: vi.fn(), destroy: vi.fn(), sign: vi.fn() }, enqueue: vi.fn() }));
vi.mock('../src/services/notification.service.js', () => ({ notify: (...a) => m.notify(...a) }));
vi.mock('../src/models/User.js', () => ({ default: m.User }));
vi.mock('../src/models/Property.js', () => ({ default: m.Property }));
vi.mock('../src/models/Report.js', () => ({ default: m.Report }));
vi.mock('../src/models/RefreshToken.js', () => ({ default: m.RefreshToken }));
vi.mock('../src/models/VerificationRequest.js', () => ({ default: m.VerificationRequest }));
vi.mock('../src/models/Category.js', () => ({ default: m.Category }));
vi.mock('../src/models/AuditLog.js', () => ({ default: m.AuditLog }));
vi.mock('../src/services/property.service.js', () => ({ changeStatus: (...a) => m.changeStatus(...a) }));
vi.mock('../src/services/email.service.js', () => ({ sendListingDecisionEmail: (...a) => m.listingEmail(...a), sendVerificationDecisionEmail: (...a) => m.email(...a) }));
vi.mock('../src/services/cloudinary.service.js', () => ({
  isConfigured: () => m.cloud.configured, uploadPrivateDocument: (...a) => m.cloud.upload(...a), destroyImage: (...a) => m.cloud.destroy(...a), signedDocumentUrl: (...a) => m.cloud.sign(...a),
}));
vi.mock('../src/services/cleanup.service.js', () => ({ enqueueDestroy: (...a) => m.enqueue(...a) }));

const v = await import('../src/validators/admin.validator.js');
const stats = await import('../src/services/adminStats.service.js');
const { recordAudit } = await import('../src/services/audit.service.js');
const users = await import('../src/services/adminUsers.service.js');
const props = await import('../src/services/adminProperties.service.js');
const reports = await import('../src/services/adminReports.service.js');
const verification = await import('../src/services/verification.service.js');
const categories = await import('../src/services/category.service.js');
const { uploadDocuments } = await import('../src/middleware/upload.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { detectDocumentType } = await import('../src/utils/imageFiles.js');

// Audit entries are checked through the real audit service writing to a mocked AuditLog.
const logged = () => m.AuditLog.create.mock.calls.map((c) => c[0]);
const admin = { _id: 'admin1', name: 'Ada Admin', role: 'admin' };
const id = 'a'.repeat(24);

beforeEach(() => {
  m.AuditLog.create = vi.fn(async () => ({}));
  m.notify.mockReset();
  m.changeStatus.mockReset().mockResolvedValue({});
  m.email.mockReset().mockResolvedValue(); m.listingEmail.mockReset().mockResolvedValue(); m.enqueue.mockReset().mockResolvedValue();
  Object.assign(m.cloud, { configured: true });
  m.cloud.upload.mockReset().mockImplementation(async () => ({ publicId: `gf/v/${Math.random()}`, format: 'jpg', resourceType: 'image', bytes: 1000 }));
  m.cloud.destroy.mockReset().mockResolvedValue('ok');
  m.cloud.sign.mockReset().mockReturnValue({ url: 'https://signed.example/doc', expiresAt: new Date('2030-01-01') });
});

describe('admin request validation', () => {
  it('a suspension needs a reason, a reactivation does not', () => {
    expect(v.userStatusBody.safeParse({ isActive: false }).success).toBe(false);
    expect(v.userStatusBody.safeParse({ isActive: false, reason: 'abc' }).success).toBe(false);
    expect(v.userStatusBody.safeParse({ isActive: false, reason: 'Repeated fake listings' }).success).toBe(true);
    expect(v.userStatusBody.safeParse({ isActive: true }).success).toBe(true);
  });
  it('rejecting a listing needs a reason, approving does not', () => {
    expect(v.moderationBody.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(v.moderationBody.safeParse({ decision: 'reject', reason: 'Photos are unclear' }).success).toBe(true);
    expect(v.moderationBody.safeParse({ decision: 'approve' }).success).toBe(true);
    expect(v.moderationBody.safeParse({ decision: 'delete' }).success).toBe(false);
  });
  it('report outcomes need a note, and listing actions only apply when resolving', () => {
    expect(v.reportUpdateBody.safeParse({ status: 'under_review' }).success).toBe(true);
    expect(v.reportUpdateBody.safeParse({ status: 'resolved' }).success).toBe(false);
    expect(v.reportUpdateBody.safeParse({ status: 'dismissed', resolution: 'Not a problem' }).success).toBe(true);
    expect(v.reportUpdateBody.safeParse({ status: 'dismissed', resolution: 'Not a problem', propertyAction: 'pause' }).success).toBe(false);
    expect(v.reportUpdateBody.safeParse({ status: 'resolved', resolution: 'Confirmed fake', propertyAction: 'reject' }).success).toBe(true);
    expect(v.reportUpdateBody.safeParse({ status: 'resolved', resolution: 'ok ok', propertyAction: 'delete' }).success).toBe(false);
  });
  it('verification decisions other than approve need a reason', () => {
    expect(v.verificationDecisionBody.safeParse({ decision: 'approve' }).success).toBe(true);
    expect(v.verificationDecisionBody.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(v.verificationDecisionBody.safeParse({ decision: 'revoke', reason: 'Documents were forged' }).success).toBe(true);
  });
  it('lists accept filters from the URL and reject nonsense', () => {
    expect(v.usersQuery.parse({ role: 'owner,agent', status: 'suspended', q: 'sam' })).toMatchObject({ role: ['owner', 'agent'], status: 'suspended', q: 'sam', page: 1, limit: 20 });
    expect(v.usersQuery.safeParse({ role: 'superuser' }).success).toBe(false);
    expect(v.adminPropertiesQuery.safeParse({ status: 'pending_review', featured: 'true', owner: id }).success).toBe(true);
    expect(v.adminPropertiesQuery.safeParse({ owner: 'x' }).success).toBe(false);
    expect(v.auditQuery.safeParse({ action: 'user.suspend', from: '2026-10-01', to: '2026-10-05' }).success).toBe(true);
    expect(v.auditQuery.safeParse({ from: '2026-10-05', to: '2026-10-01' }).success).toBe(false);
    expect(v.auditQuery.safeParse({ action: 'user.promote' }).success).toBe(false);
    expect(v.categoryBody.safeParse({}).success).toBe(false);
    expect(v.categoryBody.safeParse({ isActive: false, sortOrder: 20 }).success).toBe(true);
  });
});

describe('statistics helpers', () => {
  const now = new Date('2026-10-11T20:30:00Z'); // already 12 October in Pakistan
  it('gives a point for every day, including days with nothing, ending today in Pakistan', () => {
    const s = stats.series([{ _id: '2026-10-12', n: 4 }, { _id: '2026-10-09', n: 2 }], { days: 30, now });
    expect(s).toHaveLength(30);
    expect(s.at(-1)).toEqual({ date: '2026-10-12', count: 4 });
    expect(s.find((d) => d.date === '2026-10-09').count).toBe(2);
    expect(s.find((d) => d.date === '2026-10-10').count).toBe(0);
    expect(new Set(s.map((d) => d.date)).size).toBe(30);
    expect(s[0].date).toBe('2026-09-13');
  });
  it('splits moderation activity into approved and rejected per day', () => {
    const rows = [{ _id: { day: '2026-10-12', action: 'listing.approve' }, n: 3 }, { _id: { day: '2026-10-12', action: 'listing.reject' }, n: 1 }, { _id: { day: '2026-10-11', action: 'listing.approve' }, n: 2 }];
    const s = stats.multiSeries(rows, { approved: 'listing.approve', rejected: 'listing.reject' }, { days: 3, now });
    expect(s).toEqual([{ date: '2026-10-10', approved: 0, rejected: 0 }, { date: '2026-10-11', approved: 2, rejected: 0 }, { date: '2026-10-12', approved: 3, rejected: 1 }]);
  });
});

describe('audit log', () => {
  it('records who did what, truncating long summaries', async () => {
    await recordAudit(admin, { action: 'user.suspend', targetType: 'user', targetId: id, summary: 'x'.repeat(500), ip: '1.2.3.4' });
    expect(logged()[0]).toMatchObject({ actor: 'admin1', actorName: 'Ada Admin', action: 'user.suspend', targetId: id, ip: '1.2.3.4' });
    expect(logged()[0].summary).toHaveLength(300);
  });
  it('never throws, so a logging problem cannot undo the action it describes', async () => {
    m.AuditLog.create.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordAudit(admin, { action: 'user.suspend', targetType: 'user', targetId: id, summary: 's' })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('AUDIT WRITE FAILED'), 'db down');
    spy.mockRestore();
  });
});

describe('suspending users', () => {
  const target = (over = {}) => ({ _id: 'user1', name: 'Olivia', email: 'o@x.com', role: 'owner', isActive: true, save: vi.fn(async () => {}), ...over });
  beforeEach(() => {
    m.RefreshToken.updateMany = vi.fn(async () => ({}));
    m.Property.updateMany = vi.fn(async () => ({ modifiedCount: 3 }));
  });

  it('refuses to suspend yourself, another administrator, or someone already suspended', async () => {
    m.User.findById = vi.fn(() => chain(target({ _id: 'admin1', role: 'owner' })));
    await expect(users.setUserStatus(admin, 'admin1', { isActive: false, reason: 'testing' })).rejects.toMatchObject({ status: 409 });
    m.User.findById = vi.fn(() => chain(target({ role: 'admin' })));
    await expect(users.setUserStatus(admin, 'user1', { isActive: false, reason: 'testing' })).rejects.toMatchObject({ status: 403 });
    m.User.findById = vi.fn(() => chain(target({ isActive: false })));
    await expect(users.setUserStatus(admin, 'user1', { isActive: false, reason: 'testing' })).rejects.toMatchObject({ status: 409 });
    expect(m.RefreshToken.updateMany).not.toHaveBeenCalled(); expect(logged()).toHaveLength(0);
  });
  it('suspending ends their sessions, pauses live listings (remembering why) and is audited with the reason', async () => {
    const t = target(); m.User.findById = vi.fn(() => chain(t));
    const out = await users.setUserStatus(admin, 'user1', { isActive: false, reason: 'Repeated fake listings' }, '9.9.9.9');
    expect(t).toMatchObject({ isActive: false, suspensionReason: 'Repeated fake listings' }); expect(t.suspendedAt).toBeInstanceOf(Date);
    expect(m.RefreshToken.updateMany).toHaveBeenCalledWith({ user: 'user1', revokedAt: null }, { revokedAt: expect.any(Date) });
    expect(m.Property.updateMany).toHaveBeenCalledWith({ owner: 'user1', status: 'published' }, { status: 'paused', pausedReason: 'owner_suspended' });
    expect(out.pausedListings).toBe(3);
    expect(logged()[0]).toMatchObject({ action: 'user.suspend', targetType: 'user', ip: '9.9.9.9', meta: { reason: 'Repeated fake listings', pausedListings: 3 } });
  });
  it('reactivating restores only the listings the suspension itself paused', async () => {
    const t = target({ isActive: false, suspensionReason: 'x', suspendedAt: new Date() }); m.User.findById = vi.fn(() => chain(t));
    await users.setUserStatus(admin, 'user1', { isActive: true });
    expect(t.isActive).toBe(true); expect(t.suspensionReason).toBeUndefined();
    expect(m.Property.updateMany).toHaveBeenCalledWith({ owner: 'user1', status: 'paused', pausedReason: 'owner_suspended' }, { status: 'published', $unset: { pausedReason: 1 } });
    expect(m.RefreshToken.updateMany).not.toHaveBeenCalled();
    expect(logged()[0].action).toBe('user.reactivate');
  });
  it('lists users with counts, never exposing password data', async () => {
    m.User.find = vi.fn(() => chain([{ _id: 'u1', name: 'Sam', email: 's@x.com', role: 'buyer', isActive: true, passwordHash: 'SECRET', createdAt: 1 }]));
    m.User.countDocuments = vi.fn(async () => 1);
    m.Property.aggregate = vi.fn(async () => [{ _id: 'u1', n: 2 }]);
    const r = await users.listUsers({ page: 1, limit: 20, q: 'a.b(', role: ['owner'], status: 'suspended' });
    expect(JSON.stringify(r)).not.toContain('SECRET'); expect(r.items[0].listingCount).toBe(2);
    const filter = m.User.find.mock.calls[0][0];
    expect(filter.isActive).toBe(false); expect(filter.role).toEqual({ $in: ['owner'] });
    expect(filter.$or[0].name.$regex).toBe('a\\.b\\('); // search text is escaped, never used as a pattern
  });
});

describe('moderation', () => {
  const listing = (over = {}) => ({ _id: 'p1', title: 'House', slug: 'house-1', referenceId: 'GF-1', status: 'pending_review', owner: { _id: 'o1', name: 'Olivia', email: 'o@x.com' }, toObject() { return { ...this }; }, ...over });
  beforeEach(() => { m.Property.findById = vi.fn(() => chain(listing())); });

  it('only listings waiting for review can be approved or rejected', async () => {
    m.Property.findById = vi.fn(() => chain(listing({ status: 'published' })));
    await expect(props.moderate(admin, 'p1', { decision: 'approve' })).rejects.toMatchObject({ status: 409 });
    m.Property.findById = vi.fn(() => chain(null));
    await expect(props.moderate(admin, 'p1', { decision: 'approve' })).rejects.toMatchObject({ status: 404 });
    expect(m.changeStatus).not.toHaveBeenCalled();
  });
  it('approving publishes, records the decision and emails the owner', async () => {
    const p = listing(); m.Property.findById = vi.fn(() => chain(p));
    await props.moderate(admin, 'p1', { decision: 'approve' }, '1.1.1.1');
    expect(m.changeStatus).toHaveBeenCalledWith(p, 'published', admin, undefined);
    expect(logged()[0]).toMatchObject({ action: 'listing.approve', targetId: 'p1' });
    expect(m.listingEmail).toHaveBeenCalledWith(p.owner, p, 'approve', undefined);
  });
  it('rejecting passes the reason on, and keeps the internal note away from the owner-facing reason', async () => {
    const p = listing(); m.Property.findById = vi.fn(() => chain(p));
    await props.moderate(admin, 'p1', { decision: 'reject', reason: 'Photos are unclear', note: 'Second time this owner' });
    expect(m.changeStatus).toHaveBeenCalledWith(p, 'rejected', admin, 'Photos are unclear');
    expect(p.moderationNote).toBe('Second time this owner');
    expect(m.listingEmail.mock.calls[0][3]).toBe('Photos are unclear');
    expect(logged()[0].action).toBe('listing.reject');
  });
  it('a failure to email does not undo the decision', async () => {
    m.listingEmail.mockRejectedValue(new Error('smtp down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(props.moderate(admin, 'p1', { decision: 'approve' })).resolves.toBeTruthy();
    spy.mockRestore();
  });
  it('does not audit or email when the listing cannot be published (e.g. no photos)', async () => {
    m.changeStatus.mockRejectedValue(Object.assign(new Error('Add at least 1 photo'), { status: 422 }));
    await expect(props.moderate(admin, 'p1', { decision: 'approve' })).rejects.toMatchObject({ status: 422 });
    expect(logged()).toHaveLength(0); expect(m.listingEmail).not.toHaveBeenCalled();
  });
  it('only published listings can be featured, and unfeaturing is always possible', async () => {
    m.Property.findById = vi.fn(() => chain(listing({ status: 'draft', isFeatured: false, save: vi.fn(), toObject() { return {}; } })));
    await expect(props.setFeatured(admin, 'p1', true)).rejects.toMatchObject({ status: 409 });
    const pub = listing({ status: 'published', isFeatured: true, save: vi.fn(async () => {}) }); m.Property.findById = vi.fn(() => chain(pub));
    await props.setFeatured(admin, 'p1', false);
    expect(pub.isFeatured).toBe(false); expect(logged()[0].action).toBe('listing.feature');
  });
  it('lists every listing with the owner\'s email and open report counts, and searches safely', async () => {
    m.Property.find = vi.fn(() => chain([{ _id: 'p1', title: 'House', slug: 's', status: 'draft', images: [{ _id: 'i', url: 'u', publicId: 'secret/id' }], owner: { _id: 'o1', name: 'Olivia', email: 'o@x.com', role: 'owner' }, location: { city: 'Lahore' } }]));
    m.Property.countDocuments = vi.fn(async () => 1); m.Report.aggregate = vi.fn(async () => [{ _id: 'p1', n: 2 }]);
    const r = await props.listAll({ page: 1, limit: 20, q: '.*', status: 'draft', city: 'LAHORE' });
    expect(r.items[0]).toMatchObject({ ownerInfo: { email: 'o@x.com' }, openReports: 2, imageCount: 1 });
    const filter = m.Property.find.mock.calls[0][0];
    expect(filter.status).toBe('draft'); expect(filter['location.citySlug']).toBe('lahore'); expect(filter.$or[0].title.$regex).toBe('\\.\\*');
  });
});

describe('report handling', () => {
  const report = (over = {}) => ({ _id: 'r1', status: 'open', property: 'p1', propertyTitle: 'House', reason: 'fake_listing', save: vi.fn(async () => {}), populate: vi.fn(async () => {}), toObject() { return { ...this, property: { _id: 'p1', title: 'House', slug: 's', status: 'paused' } }; }, ...over });
  beforeEach(() => { m.Report.findById = vi.fn(() => chain(report())); m.Property.findById = vi.fn(() => chain({ _id: 'p1', status: 'published' })); });

  it('follows open -> under review -> resolved or dismissed, and finished reports stay finished', async () => {
    for (const s of ['resolved', 'dismissed']) {
      m.Report.findById = vi.fn(() => chain(report({ status: s })));
      await expect(reports.updateReport(admin, 'r1', { status: 'under_review' })).rejects.toMatchObject({ status: 409 });
    }
    m.Report.findById = vi.fn(() => chain(report({ status: 'under_review' })));
    await expect(reports.updateReport(admin, 'r1', { status: 'under_review' })).rejects.toMatchObject({ status: 409 });
  });
  it('records who reviewed it, when, and the outcome', async () => {
    const r = report(); m.Report.findById = vi.fn(() => chain(r));
    await reports.updateReport(admin, 'r1', { status: 'dismissed', resolution: 'Checked: all correct' });
    expect(r).toMatchObject({ status: 'dismissed', reviewedBy: 'admin1', resolution: 'Checked: all correct' });
    expect(logged()[0]).toMatchObject({ action: 'report.update', targetType: 'report' });
  });
  it('can pause the listing as part of resolving, and does so before closing the report', async () => {
    const r = report(); m.Report.findById = vi.fn(() => chain(r));
    const order = [];
    m.changeStatus.mockImplementation(async () => { order.push('listing'); });
    r.save = vi.fn(async () => { order.push('report'); });
    await reports.updateReport(admin, 'r1', { status: 'resolved', resolution: 'Confirmed fake', propertyAction: 'pause' });
    expect(m.changeStatus).toHaveBeenCalledWith({ _id: 'p1', status: 'published' }, 'paused', admin, 'Confirmed fake');
    expect(order).toEqual(['listing', 'report']);
    expect(logged()[0].meta.listingChange).toBe('paused');
  });
  it('uses the note as the rejection reason when rejecting the listing', async () => {
    await reports.updateReport(admin, 'r1', { status: 'resolved', resolution: 'Photos belong to another house', propertyAction: 'reject' });
    expect(m.changeStatus.mock.calls[0].slice(1)).toEqual(['rejected', admin, 'Photos belong to another house']);
  });
  it('leaves the report untouched if the listing cannot make the change', async () => {
    const r = report(); m.Report.findById = vi.fn(() => chain(r));
    m.changeStatus.mockRejectedValue(Object.assign(new Error('cannot'), { status: 409 }));
    await expect(reports.updateReport(admin, 'r1', { status: 'resolved', resolution: 'Confirmed fake', propertyAction: 'pause' })).rejects.toMatchObject({ status: 409 });
    expect(r.status).toBe('open'); expect(r.save).not.toHaveBeenCalled(); expect(logged()).toHaveLength(0);
  });
  it('says so when the listing no longer exists', async () => {
    m.Property.findById = vi.fn(() => chain(null));
    await expect(reports.updateReport(admin, 'r1', { status: 'resolved', resolution: 'Confirmed fake', propertyAction: 'pause' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('verification', () => {
  const file = (name = 'id-card.jpg') => ({ buffer: Buffer.from('x'), originalname: name });
  const owner = (over = {}) => ({ _id: 'u1', name: 'Olivia', role: 'owner', verificationStatus: 'none', save: vi.fn(async () => {}), ...over });
  beforeEach(() => {
    m.VerificationRequest.exists = vi.fn(async () => null);
    m.VerificationRequest.create = vi.fn(async (d) => ({ _id: 'v1', status: 'pending', submittedAt: new Date(), ...d }));
    m.User.updateOne = vi.fn(async () => ({}));
  });

  it('only owners and agents can apply, once, and not when already verified', async () => {
    await expect(verification.submit(owner({ role: 'buyer' }), {}, [file()])).rejects.toMatchObject({ status: 403 });
    await expect(verification.submit(owner({ verificationStatus: 'verified' }), {}, [file()])).rejects.toMatchObject({ status: 409 });
    m.VerificationRequest.exists = vi.fn(async () => ({ _id: 'x' }));
    await expect(verification.submit(owner(), {}, [file()])).rejects.toMatchObject({ code: 'VERIFICATION_PENDING' });
    expect(m.cloud.upload).not.toHaveBeenCalled();
  });
  it('explains when document storage is not configured', async () => {
    m.cloud.configured = false;
    await expect(verification.submit(owner(), {}, [file()])).rejects.toMatchObject({ status: 503, code: 'IMAGES_NOT_CONFIGURED' });
  });
  it('stores documents privately, marks the person as pending, and returns no storage ids', async () => {
    const u = owner();
    const out = await verification.submit(u, { message: 'Here are my papers' }, [file('../../etc/passwd.jpg'), file('deed.pdf')]);
    expect(m.cloud.upload.mock.calls[0][1]).toBe('makaanly/verification/u1');
    expect(u.verificationStatus).toBe('pending'); expect(u.save).toHaveBeenCalled();
    const stored = m.VerificationRequest.create.mock.calls[0][0];
    expect(stored).toMatchObject({ user: 'u1', verificationType: 'owner', documentCount: 2 });
    expect(stored.documents[0].originalName).not.toMatch(/[\\/]/);
    expect(JSON.stringify(out)).not.toMatch(/gf\/v\//);
  });
  it('deletes uploaded documents if one upload fails or the database save fails', async () => {
    m.cloud.upload.mockReset().mockResolvedValueOnce({ publicId: 'gf/v/ok', format: 'jpg', resourceType: 'image' }).mockRejectedValueOnce(new Error('cloudinary down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(verification.submit(owner(), {}, [file(), file('b.jpg')])).rejects.toMatchObject({ status: 502 });
    expect(m.cloud.destroy).toHaveBeenCalledWith('gf/v/ok', { type: 'authenticated', resourceType: 'image' });
    m.cloud.destroy.mockClear(); m.cloud.upload.mockReset().mockResolvedValue({ publicId: 'gf/v/two', format: 'jpg', resourceType: 'image' });
    m.VerificationRequest.create.mockRejectedValue(new Error('mongo down'));
    await expect(verification.submit(owner(), {}, [file()])).rejects.toThrow('mongo down');
    expect(m.cloud.destroy).toHaveBeenCalledWith('gf/v/two', { type: 'authenticated', resourceType: 'image' });
    spy.mockRestore();
  });

  describe('decisions', () => {
    const request = (over = {}) => ({ _id: 'v1', status: 'pending', verificationType: 'owner', documentCount: 0, documents: [{ _id: 'd1', publicId: 'gf/v/a', format: 'jpg', resourceType: 'image', originalName: 'id.jpg' }, { _id: 'd2', publicId: 'gf/v/b', format: 'pdf', resourceType: 'image' }],
      user: { _id: 'u1', name: 'Olivia', email: 'o@x.com', role: 'owner' }, save: vi.fn(async () => {}), ...over });
    const load = (r) => { m.VerificationRequest.findById = vi.fn(() => chain(r)); return r; };

    it('approving verifies the person, deletes their documents and tells them', async () => {
      const r = load(request());
      const out = await verification.decide(admin, 'v1', { decision: 'approve' }, '2.2.2.2');
      expect(r).toMatchObject({ status: 'approved', reviewedBy: 'admin1', documentCount: 2 }); expect(r.documents).toEqual([]);
      expect(m.User.updateOne).toHaveBeenCalledWith({ _id: 'u1' }, { verificationStatus: 'verified' });
      expect(m.cloud.destroy).toHaveBeenCalledTimes(2);
      expect(m.cloud.destroy).toHaveBeenCalledWith('gf/v/a', { type: 'authenticated', resourceType: 'image' });
      expect(m.email).toHaveBeenCalledWith(r.user, 'approve', undefined);
      expect(logged()[0]).toMatchObject({ action: 'verification.approve', targetType: 'verification' });
      expect(out.documents).toEqual([]);
    });
    it('rejecting records the reason and marks the person as rejected', async () => {
      const r = load(request());
      await verification.decide(admin, 'v1', { decision: 'reject', reason: 'The photo is unreadable' });
      expect(r).toMatchObject({ status: 'rejected', rejectionReason: 'The photo is unreadable' });
      expect(m.User.updateOne).toHaveBeenCalledWith({ _id: 'u1' }, { verificationStatus: 'rejected' });
    });
    it('revoking works only on approved requests and removes the badge', async () => {
      load(request({ status: 'pending' }));
      await expect(verification.decide(admin, 'v1', { decision: 'revoke', reason: 'Forged documents' })).rejects.toMatchObject({ status: 409 });
      load(request({ status: 'approved', documents: [] }));
      await verification.decide(admin, 'v1', { decision: 'revoke', reason: 'Forged documents' });
      expect(m.User.updateOne).toHaveBeenCalledWith({ _id: 'u1' }, { verificationStatus: 'none' });
    });
    it('a decision is final: already decided requests cannot be decided again', async () => {
      load(request({ status: 'approved' }));
      await expect(verification.decide(admin, 'v1', { decision: 'approve' })).rejects.toMatchObject({ status: 409 });
      load(request({ status: 'rejected' }));
      await expect(verification.decide(admin, 'v1', { decision: 'reject', reason: 'Again please' })).rejects.toMatchObject({ status: 409 });
    });
    it('queues failed document deletions for retry, as private assets', async () => {
      load(request()); m.cloud.destroy.mockRejectedValue(new Error('timeout'));
      await verification.decide(admin, 'v1', { decision: 'approve' });
      expect(m.enqueue).toHaveBeenCalledWith([{ publicId: 'gf/v/a', deliveryType: 'authenticated', resourceType: 'image' }, { publicId: 'gf/v/b', deliveryType: 'authenticated', resourceType: 'image' }]);
    });
    it('gives reviewers a short-lived link and records that the document was opened', async () => {
      load(request());
      const out = await verification.documentLink(admin, 'v1', 'd1', '3.3.3.3');
      expect(m.cloud.sign).toHaveBeenCalledWith(expect.objectContaining({ publicId: 'gf/v/a' }), 300);
      expect(out.url).toBe('https://signed.example/doc');
      expect(logged()[0]).toMatchObject({ action: 'verification.view_document', ip: '3.3.3.3' });
    });
    it('has no document to open once it has been deleted after a decision', async () => {
      load(request({ documents: [] }));
      await expect(verification.documentLink(admin, 'v1', 'd1')).rejects.toMatchObject({ status: 404 });
      expect(m.cloud.sign).not.toHaveBeenCalled();
    });
    it('the reviewer list shows document names and sizes, never storage ids', async () => {
      m.VerificationRequest.find = vi.fn(() => chain([request()])); m.VerificationRequest.countDocuments = vi.fn(async () => 1);
      const r = await verification.listRequests({ page: 1, limit: 20, status: 'pending' });
      expect(r.items[0].documents[0]).toMatchObject({ id: 'd1', format: 'jpg', originalName: 'id.jpg' });
      expect(JSON.stringify(r)).not.toContain('gf/v/');
    });
  });
});

describe('verification uploads', () => {
  const app = express();
  app.post('/docs', uploadDocuments, (req, res) => res.json({ count: req.files.length }));
  app.use(errorHandler);
  const PDF = Buffer.from('%PDF-1.4\n%....................');
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

  it('recognises PDFs by their content', () => { expect(detectDocumentType(PDF)).toBe('application/pdf'); expect(detectDocumentType(Buffer.from('hello world, not a pdf'))).toBeNull(); });
  it('accepts photos and PDFs', async () => {
    const r = await request(app).post('/docs').attach('documents', PDF, { filename: 'deed.pdf', contentType: 'application/pdf' }).attach('documents', JPEG, { filename: 'id.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(200); expect(r.body.count).toBe(2);
  });
  it('rejects a file that lies about being a PDF, other types, nothing at all, and too many files', async () => {
    expect((await request(app).post('/docs').attach('documents', Buffer.from('<script>alert(1)</script> pretend pdf'), { filename: 'x.pdf', contentType: 'application/pdf' })).status).toBe(422);
    expect((await request(app).post('/docs').attach('documents', Buffer.from('MZ....'), { filename: 'x.exe', contentType: 'application/octet-stream' })).status).toBe(422);
    expect((await request(app).post('/docs').field('a', 'b')).status).toBe(422);
    let req = request(app).post('/docs');
    for (let i = 0; i < 4; i += 1) req = req.attach('documents', JPEG, { filename: `${i}.jpg`, contentType: 'image/jpeg' });
    expect((await req).status).toBe(422);
  });
  it('rejects files over 5 MB', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    expect((await request(app).post('/docs').attach('documents', big, { filename: 'big.jpg', contentType: 'image/jpeg' })).status).toBe(413);
  });
});

describe('property categories', () => {
  beforeEach(() => { m.Category.findOne = vi.fn(() => chain({ key: 'shop', isActive: true, sortOrder: 60, save: vi.fn(async () => {}) })); m.Category.bulkWrite = vi.fn(async () => ({})); m.Category.countDocuments = vi.fn(async () => 6); });
  it('blocks new listings of a hidden type, but not types that are active or not yet configured', async () => {
    m.Category.findOne = vi.fn(() => chain({ key: 'shop', isActive: false }));
    await expect(categories.assertTypeActive('shop')).rejects.toMatchObject({ status: 422, details: [{ field: 'propertyType' }] });
    m.Category.findOne = vi.fn(() => chain({ key: 'house', isActive: true }));
    await expect(categories.assertTypeActive('house')).resolves.toBeUndefined();
    m.Category.findOne = vi.fn(() => chain(null));
    await expect(categories.assertTypeActive('house')).resolves.toBeUndefined();
  });
  it('keeps at least one type available, and audits changes with before and after', async () => {
    categories.resetCategoryCache();
    m.Category.countDocuments = vi.fn(async () => 1);
    await expect(categories.updateCategory(admin, 'shop', { isActive: false })).rejects.toMatchObject({ status: 409 });
    m.Category.countDocuments = vi.fn(async () => 6);
    const out = await categories.updateCategory(admin, 'shop', { isActive: false, sortOrder: 5 });
    expect(out).toEqual({ key: 'shop', isActive: false, sortOrder: 5 });
    expect(logged()[0]).toMatchObject({ action: 'category.update', meta: { before: { isActive: true, sortOrder: 60 }, after: { isActive: false, sortOrder: 5 } } });
  });
});


describe('administrators\' decisions notify the people affected', () => {
  it('approving and rejecting a listing tell the owner in the app (the email is separate), with the reason when rejected', async () => {
    const listing = (over = {}) => ({ _id: 'p1', title: 'House', slug: 'house-1', status: 'pending_review', owner: { _id: 'o1', name: 'Olivia', email: 'o@x.com' }, toObject() { return { ...this }; }, ...over });
    m.Property.findById = vi.fn(() => chain(listing()));
    await props.moderate(admin, 'p1', { decision: 'approve' });
    expect(m.notify).toHaveBeenLastCalledWith('o1', expect.objectContaining({ type: 'listing.approved', link: '/properties/house-1' }));
    expect(m.notify.mock.calls.at(-1)[1].email).toBeUndefined(); // no second email
    m.Property.findById = vi.fn(() => chain(listing()));
    await props.moderate(admin, 'p1', { decision: 'reject', reason: 'Photos are unclear', note: 'internal only' });
    expect(m.notify).toHaveBeenLastCalledWith('o1', expect.objectContaining({ type: 'listing.rejected', body: 'Photos are unclear', link: '/dashboard/properties/p1/edit' }));
    expect(JSON.stringify(m.notify.mock.calls)).not.toContain('internal only');
  });
  it('a refused moderation notifies nobody', async () => {
    m.Property.findById = vi.fn(() => chain({ _id: 'p1', status: 'published', owner: { _id: 'o1' } }));
    await expect(props.moderate(admin, 'p1', { decision: 'approve' })).rejects.toMatchObject({ status: 409 });
    expect(m.notify).not.toHaveBeenCalled();
  });
  it('the reporter hears the outcome but never the internal note', async () => {
    const r = { _id: 'r1', status: 'open', reporter: 'b1', property: 'p1', propertyTitle: 'House', reason: 'fake_listing', save: vi.fn(async () => {}), populate: vi.fn(async () => {}), toObject() { return { ...this }; } };
    m.Report.findById = vi.fn(() => chain(r));
    await reports.updateReport(admin, 'r1', { status: 'dismissed', resolution: 'SECRET internal reasoning' });
    expect(m.notify).toHaveBeenLastCalledWith('b1', expect.objectContaining({ type: 'report.update' }));
    expect(JSON.stringify(m.notify.mock.calls)).not.toContain('SECRET');
    m.notify.mockReset(); m.Report.findById = vi.fn(() => chain({ ...r, status: 'open' }));
    await reports.updateReport(admin, 'r1', { status: 'under_review' }); // moving to review is not an outcome
    expect(m.notify).not.toHaveBeenCalled();
  });
  it('a verification decision tells the applicant in the app', async () => {
    const req = { _id: 'v1', status: 'pending', verificationType: 'owner', documentCount: 0, documents: [], user: { _id: 'u1', name: 'Olivia', email: 'o@x.com' }, save: vi.fn(async () => {}) };
    m.VerificationRequest.findById = vi.fn(() => chain(req)); m.User.updateOne = vi.fn(async () => ({}));
    await verification.decide(admin, 'v1', { decision: 'approve' });
    expect(m.notify).toHaveBeenLastCalledWith('u1', expect.objectContaining({ type: 'verification.decision', title: 'You are verified', link: '/dashboard/verification' }));
  });
});
