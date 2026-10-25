import { ApiError } from '../utils/ApiError.js';
import { uploadImageBuffer, destroyImage, isConfigured } from './cloudinary.service.js';
import { enqueueDestroy } from './cleanup.service.js';

export async function updateMe(user, { name, phone }) {
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone || undefined;
  await user.save();
  return user.toJSON();
}

async function dropAvatar(publicId) { // never throws; a failed delete is queued for retry
  if (!publicId) return;
  try { await destroyImage(publicId); } catch { await enqueueDestroy([publicId]).catch(() => {}); }
}

export async function setAvatar(user, file) {
  if (!isConfigured()) throw new ApiError(503, 'Photo uploads are not set up on the server yet.', { code: 'IMAGES_NOT_CONFIGURED' });
  let uploaded;
  try {
    uploaded = await uploadImageBuffer(file.buffer, 'makaanly/avatars', { transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }] });
  } catch (err) {
    console.error('Avatar upload failed:', err?.message || err);
    throw new ApiError(502, 'We could not upload that photo. Please try again.', { code: 'UPLOAD_FAILED' });
  }
  const old = user.avatar?.publicId;
  user.avatar = { url: uploaded.url, publicId: uploaded.publicId };
  try { await user.save(); } catch (err) { await dropAvatar(uploaded.publicId); throw err; }
  await dropAvatar(old);
  return user.toJSON();
}

export async function removeAvatar(user) {
  const old = user.avatar?.publicId;
  user.avatar = undefined;
  await user.save();
  await dropAvatar(old);
  return user.toJSON();
}

export async function setPreferences(user, { emailNotifications }) {
  user.notificationPrefs = { email: emailNotifications };
  await user.save();
  return user.toJSON();
}
