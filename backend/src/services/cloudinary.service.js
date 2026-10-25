import { cloudinary, isCloudinaryReady } from '../config/cloudinary.js';

export const isConfigured = () => isCloudinaryReady();

// Uploads from memory. Originals are capped at 2400px so storage stays small; delivery transforms happen in the URL.
export function uploadImageBuffer(buffer, folder, { transformation } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder, resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: transformation || [{ width: 2400, height: 2400, crop: 'limit' }], unique_filename: true, overwrite: false,
      },
      (err, res) => (err ? reject(err) : resolve({ url: res.secure_url, publicId: res.public_id })),
    );
    stream.end(buffer);
  });
}

// "not found" counts as success: the asset is already gone.
export async function destroyImage(publicId, { type = 'upload', resourceType = 'image' } = {}) {
  const res = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type, invalidate: true });
  if (!['ok', 'not found'].includes(res.result)) throw new Error(`Cloudinary destroy returned "${res.result}"`);
  return res.result;
}

// Verification documents are stored as private ("authenticated") assets: they have no public URL.
export function uploadPrivateDocument(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', type: 'authenticated', unique_filename: true, overwrite: false },
      (err, res) => (err ? reject(err) : resolve({ publicId: res.public_id, format: res.format, resourceType: res.resource_type, bytes: res.bytes })),
    );
    stream.end(buffer);
  });
}

// A download link that stops working after `seconds`.
export function signedDocumentUrl(doc, seconds) {
  const expiresAt = Math.floor(Date.now() / 1000) + seconds;
  return { url: cloudinary.utils.private_download_url(doc.publicId, doc.format, { resource_type: doc.resourceType || 'image', type: 'authenticated', expires_at: expiresAt }), expiresAt: new Date(expiresAt * 1000) };
}
