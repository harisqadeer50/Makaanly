// Cloudinary delivery transform (format/quality auto). Non-Cloudinary URLs are returned unchanged.
export function cloudinaryUrl(url, { w, h, crop = 'fill' } = {}) {
  if (!url || !url.includes('/upload/')) return url;
  const t = ['f_auto', 'q_auto', w && `w_${w}`, h && `h_${h}`, (w || h) && `c_${crop}`].filter(Boolean).join(',');
  return url.replace('/upload/', `/upload/${t}/`);
}
