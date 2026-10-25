import VerificationRequest from '../models/VerificationRequest.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta } from '../utils/response.js';
import { uploadPrivateDocument, destroyImage, signedDocumentUrl, isConfigured } from './cloudinary.service.js';
import { enqueueDestroy } from './cleanup.service.js';
import { sendVerificationDecisionEmail } from './email.service.js';
import { recordAudit } from './audit.service.js';
import { notify } from './notification.service.js';
import { DOCUMENT_LINK_SECONDS } from '../config/constants.js';

const safeName = (n = '') => String(n).replace(/[\\/]/g, '_').replace(/[^\p{L}\p{N}._ -]/gu, '').trim().slice(0, 80) || 'document';
const pending = () => new ApiError(409, 'You already have a verification request under review.', { code: 'VERIFICATION_PENDING' });

// Deletes now; anything that fails is queued for retry (with the details needed to delete a private asset).
async function destroyDocuments(docs) {
  if (!docs.length) return;
  const results = await Promise.allSettled(docs.map((d) => destroyImage(d.publicId, { type: 'authenticated', resourceType: d.resourceType })));
  const failed = docs.filter((_, i) => results[i].status === 'rejected').map((d) => ({ publicId: d.publicId, deliveryType: 'authenticated', resourceType: d.resourceType }));
  if (failed.length) await enqueueDestroy(failed).catch((e) => console.error('Could not queue document cleanup:', e.message));
}

const serializeDoc = (d) => ({ id: String(d._id), format: d.format, originalName: d.originalName, bytes: d.bytes });
const serialize = (r, { forAdmin = false } = {}) => ({
  id: String(r._id), verificationType: r.verificationType, status: r.status, message: r.message || null, submittedAt: r.submittedAt, reviewedAt: r.reviewedAt || null,
  rejectionReason: r.rejectionReason || null, documentCount: r.documents?.length || r.documentCount || 0,
  ...(forAdmin ? { documents: (r.documents || []).map(serializeDoc), user: r.user?.name ? { id: String(r.user._id), name: r.user.name, email: r.user.email, role: r.user.role, createdAt: r.user.createdAt } : null, reviewedBy: r.reviewedBy?.name || null } : {}),
});

// ---- the applicant ----
export async function submit(user, { message }, files) {
  if (!['agent', 'owner'].includes(user.role)) throw ApiError.forbidden('Only owner and agent accounts can apply for verification.');
  if (user.verificationStatus === 'verified') throw ApiError.conflict('Your account is already verified.');
  if (!isConfigured()) throw new ApiError(503, 'Document uploads are not set up on the server yet.', { code: 'IMAGES_NOT_CONFIGURED' });
  if (await VerificationRequest.exists({ user: user._id, status: 'pending' })) throw pending();

  const settled = await Promise.allSettled(files.map((f) => uploadPrivateDocument(f.buffer, `makaanly/verification/${user._id}`)));
  const uploaded = settled.filter((s) => s.status === 'fulfilled').map((s, i) => ({ ...s.value, originalName: safeName(files[i]?.originalname) }));
  if (settled.some((s) => s.status === 'rejected')) {
    await destroyDocuments(uploaded);
    console.error('Verification upload failed:', settled.find((s) => s.status === 'rejected').reason?.message);
    throw new ApiError(502, 'We could not upload your documents. Please try again.', { code: 'UPLOAD_FAILED' });
  }
  try {
    const request = await VerificationRequest.create({ user: user._id, verificationType: user.role, message, documents: uploaded, documentCount: uploaded.length });
    user.verificationStatus = 'pending';
    await user.save();
    return serialize(request);
  } catch (err) {
    await destroyDocuments(uploaded); // never leave identity documents behind
    if (err?.code === 11000) throw pending();
    throw err;
  }
}

export async function myStatus(user) {
  const latest = await VerificationRequest.findOne({ user: user._id }).sort({ submittedAt: -1 }).lean();
  return { verificationStatus: user.verificationStatus, request: latest ? serialize(latest) : null };
}

// ---- reviewers ----
export async function listRequests({ page, limit, status }) {
  const filter = status ? { status } : {};
  const [rows, total] = await Promise.all([
    VerificationRequest.find(filter).sort(status === 'pending' || !status ? { submittedAt: 1 } : { reviewedAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('user', 'name email role createdAt').populate('reviewedBy', 'name').lean(),
    VerificationRequest.countDocuments(filter),
  ]);
  return { items: rows.map((r) => serialize(r, { forAdmin: true })), meta: paginationMeta({ page, limit, total }) };
}

// A short-lived link to one document. Opening a document is recorded in the audit log.
export async function documentLink(admin, id, docId, ip) {
  const request = await VerificationRequest.findById(id);
  const doc = request?.documents.find((d) => String(d._id) === String(docId));
  if (!doc) throw ApiError.notFound('Document not found. It may have been deleted after the decision.');
  const link = signedDocumentUrl(doc, DOCUMENT_LINK_SECONDS);
  await recordAudit(admin, { action: 'verification.view_document', targetType: 'verification', targetId: request._id, summary: `Opened a verification document for ${String(request.user)}`, meta: { documentId: String(doc._id) }, ip });
  return { ...link, name: doc.originalName };
}

const NEXT = { approve: { from: 'pending', to: 'approved', userStatus: 'verified' }, reject: { from: 'pending', to: 'rejected', userStatus: 'rejected' }, revoke: { from: 'approved', to: 'revoked', userStatus: 'none' } };

export async function decide(admin, id, { decision, reason }, ip) {
  const request = await VerificationRequest.findById(id).populate('user');
  if (!request) throw ApiError.notFound('Verification request not found');
  const rule = NEXT[decision];
  if (request.status !== rule.from) throw ApiError.conflict(`A ${request.status} request cannot be ${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'revoked'}.`);
  if (!request.user) throw ApiError.conflict('The applicant account no longer exists.');

  const docs = [...request.documents];
  request.status = rule.to; request.reviewedBy = admin._id; request.reviewedAt = new Date();
  request.rejectionReason = decision === 'approve' ? undefined : reason;
  request.documentCount = Math.max(request.documentCount, docs.length);
  request.documents = []; // documents are not kept after a decision
  await request.save();
  await User.updateOne({ _id: request.user._id }, { verificationStatus: rule.userStatus });
  await destroyDocuments(docs);

  await recordAudit(admin, { action: `verification.${decision}`, targetType: 'verification', targetId: request._id, summary: `${decision === 'approve' ? 'Approved' : decision === 'reject' ? 'Rejected' : 'Revoked'} ${request.verificationType} verification for ${request.user.name}`, meta: { reason }, ip });
  notify(request.user._id, { type: 'verification.decision', title: { approve: 'You are verified', reject: 'Your verification request was not approved', revoke: 'Your verified status was removed' }[decision], body: reason || 'A verified badge now shows on your profile and listings.', link: '/dashboard/verification' });
  sendVerificationDecisionEmail(request.user, decision, reason).catch((e) => console.error('Verification email failed:', e.message));
  return serialize(request, { forAdmin: true });
}
