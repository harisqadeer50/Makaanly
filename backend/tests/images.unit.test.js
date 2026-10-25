import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'test';

const m = vi.hoisted(() => ({
  configured: true, n: 0, uploadFail: null,
  upload: vi.fn(), destroy: vi.fn(), enqueue: vi.fn(),
}));
vi.mock('../src/services/cloudinary.service.js', () => ({
  isConfigured: () => m.configured,
  uploadImageBuffer: (...a) => m.upload(...a),
  destroyImage: (...a) => m.destroy(...a),
}));
vi.mock('../src/services/cleanup.service.js', () => ({ enqueueDestroy: (...a) => m.enqueue(...a) }));

const { detectImageType } = await import('../src/utils/imageFiles.js');
const { uploadImages, uploadSingleImage } = await import('../src/middleware/upload.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const img = await import('../src/services/image.service.js');

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(16)]);

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP by their bytes', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(WEBP)).toBe('image/webp');
  });
  it('rejects everything else', () => {
    expect(detectImageType(Buffer.from('<?php echo 1; ?> padding padding'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'.padEnd(20, 'x')))).toBeNull();
    expect(detectImageType(Buffer.alloc(4))).toBeNull();
    expect(detectImageType(null)).toBeNull();
  });
});

describe('upload middleware', () => {
  const app = express();
  app.post('/many', uploadImages, (req, res) => res.json({ count: req.files.length }));
  app.post('/one', uploadSingleImage, (req, res) => res.json({ count: req.files.length }));
  app.use(errorHandler);

  it('accepts real images', async () => {
    const r = await request(app).post('/many').attach('images', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' }).attach('images', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(r.status).toBe(200); expect(r.body.count).toBe(2);
  });
  it('accepts a single replacement image', async () => {
    const r = await request(app).post('/one').attach('image', WEBP, { filename: 'a.webp', contentType: 'image/webp' });
    expect(r.status).toBe(200);
  });
  it('rejects a file that lies about its type', async () => {
    const r = await request(app).post('/many').attach('images', Buffer.from('<script>alert(1)</script> not an image at all'), { filename: 'evil.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(422); expect(r.body.errors[0].message).toMatch(/only JPEG, PNG or WebP/);
  });
  it('rejects disallowed content types before reading them', async () => {
    const r = await request(app).post('/many').attach('images', Buffer.from('%PDF-1.4 ......'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(422);
  });
  it('rejects files over 5 MB with 413', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    const r = await request(app).post('/many').attach('images', big, { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(413); expect(r.body.code).toBe('FILE_TOO_LARGE');
  });
  it('rejects more than 10 files and empty requests', async () => {
    let req = request(app).post('/many');
    for (let i = 0; i < 11; i += 1) req = req.attach('images', JPEG, { filename: `${i}.jpg`, contentType: 'image/jpeg' });
    expect((await req).status).toBe(422);
    const none = await request(app).post('/many').field('x', 'y');
    expect(none.status).toBe(422); expect(none.body.errors[0].message).toMatch(/at least one photo/);
  });
});

describe('image service', () => {
  const file = (n = 1) => ({ buffer: JPEG, originalname: `${n}.jpg` });
  const photo = (id, extra = {}) => ({ _id: id, url: `u/${id}`, publicId: `pid/${id}`, isCover: false, altText: '', ...extra });
  const prop = (images = [], status = 'draft') => ({ _id: 'p1', status, title: 'T', images, saves: 0, async save() { this.saves += 1; } });
  const owner = { role: 'owner' }; const admin = { role: 'admin' };

  beforeEach(() => {
    m.configured = true; m.n = 0;
    m.upload.mockReset().mockImplementation(async () => { m.n += 1; return { url: `https://res.cloudinary.com/x/${m.n}.jpg`, publicId: `gf/${m.n}` }; });
    m.destroy.mockReset().mockResolvedValue('ok'); m.enqueue.mockReset().mockResolvedValue();
  });

  it('uploads, makes the first photo the cover, and saves once', async () => {
    const p = prop();
    await img.addImages(p, [file(1), file(2)], owner);
    expect(p.images.map((i) => i.isCover)).toEqual([true, false]);
    expect(p.saves).toBe(1);
    expect(m.upload.mock.calls[0][1]).toBe('makaanly/properties/p1');
  });
  it('keeps an existing cover when adding more', async () => {
    const p = prop([photo('a', { isCover: true })]);
    await img.addImages(p, [file()], owner);
    expect(p.images.filter((i) => i.isCover)).toHaveLength(1); expect(p.images[0].isCover).toBe(true);
  });
  it('refuses to exceed 10 photos, before uploading anything', async () => {
    const p = prop(Array.from({ length: 9 }, (_, i) => photo(`i${i}`)));
    await expect(img.addImages(p, [file(1), file(2)], owner)).rejects.toMatchObject({ status: 422 });
    expect(m.upload).not.toHaveBeenCalled();
  });
  it('cleans up already-uploaded photos when another upload fails', async () => {
    m.upload.mockReset().mockResolvedValueOnce({ url: 'u1', publicId: 'gf/ok' }).mockRejectedValueOnce(new Error('cloudinary down'));
    const p = prop();
    await expect(img.addImages(p, [file(1), file(2)], owner)).rejects.toMatchObject({ code: 'UPLOAD_FAILED', status: 502 });
    expect(m.destroy).toHaveBeenCalledWith('gf/ok');
    expect(p.images).toHaveLength(0); expect(p.saves).toBe(0);
  });
  it('removes the uploaded assets when the database save fails', async () => {
    const p = prop(); p.save = async () => { throw new Error('mongo down'); };
    await expect(img.addImages(p, [file()], owner)).rejects.toThrow('mongo down');
    expect(m.destroy).toHaveBeenCalledWith('gf/1');
  });
  it('queues a retry when the cleanup itself fails after the save failed', async () => {
    const p = prop(); p.save = async () => { throw new Error('mongo down'); };
    m.destroy.mockRejectedValue(new Error('cloudinary down'));
    await expect(img.addImages(p, [file()], owner)).rejects.toThrow('mongo down');
    expect(m.enqueue).toHaveBeenCalledWith(['gf/1']);
  });
  it('reports a clear error when Cloudinary is not configured', async () => {
    m.configured = false;
    await expect(img.addImages(prop(), [file()], owner)).rejects.toMatchObject({ status: 503, code: 'IMAGES_NOT_CONFIGURED' });
  });
  it('blocks owners from editing sold listings, but not admins', async () => {
    await expect(img.addImages(prop([], 'sold'), [file()], owner)).rejects.toMatchObject({ status: 409 });
    await expect(img.addImages(prop([], 'sold'), [file()], admin)).resolves.toBeTruthy();
  });

  it('removing the cover promotes the next photo, and deletes the asset after saving', async () => {
    const p = prop([photo('a', { isCover: true }), photo('b')]);
    await img.removeImage(p, 'a', owner);
    expect(p.images.map((i) => [i._id, i.isCover])).toEqual([['b', true]]);
    expect(m.destroy).toHaveBeenCalledWith('pid/a');
  });
  it('queues the asset for retry instead of failing when Cloudinary is down', async () => {
    m.destroy.mockRejectedValue(new Error('timeout'));
    const p = prop([photo('a', { isCover: true }), photo('b')]);
    await expect(img.removeImage(p, 'b', owner)).resolves.toBeTruthy();
    expect(m.enqueue).toHaveBeenCalledWith(['pid/b']);
  });
  it('keeps at least one photo on a live listing, but allows removing the last one from a draft', async () => {
    await expect(img.removeImage(prop([photo('a', { isCover: true })], 'published'), 'a', owner)).rejects.toMatchObject({ status: 409 });
    await expect(img.removeImage(prop([photo('a', { isCover: true })], 'pending_review'), 'a', admin)).rejects.toMatchObject({ status: 409 });
    await expect(img.removeImage(prop([photo('a', { isCover: true })], 'draft'), 'a', owner)).resolves.toBeTruthy();
  });
  it('404s for a photo that is not on the listing', async () => {
    await expect(img.removeImage(prop([photo('a')]), 'zzz', owner)).rejects.toMatchObject({ status: 404 });
  });

  it('replaces a photo in place (position, cover and alt text kept) and deletes the old asset', async () => {
    const p = prop([photo('a', { isCover: true, altText: 'Lounge' }), photo('b')]);
    await img.replaceImage(p, 'a', file(), owner);
    expect(p.images[0]).toMatchObject({ _id: 'a', isCover: true, altText: 'Lounge', publicId: 'gf/1' });
    expect(m.destroy).toHaveBeenCalledWith('pid/a');
  });
  it('replace removes the new upload if saving fails, and keeps the old one', async () => {
    const p = prop([photo('a')]); p.save = async () => { throw new Error('mongo down'); };
    await expect(img.replaceImage(p, 'a', file(), owner)).rejects.toThrow('mongo down');
    expect(m.destroy).toHaveBeenCalledWith('gf/1'); expect(m.destroy).not.toHaveBeenCalledWith('pid/a');
  });

  it('reorders, picks the cover and sets alt text in one save', async () => {
    const p = prop([photo('a', { isCover: true }), photo('b'), photo('c')]);
    await img.updateImageMeta(p, { order: ['c', 'a', 'b'], coverId: 'c', altTexts: { b: 'Kitchen' } }, owner);
    expect(p.images.map((i) => i._id)).toEqual(['c', 'a', 'b']);
    expect(p.images.map((i) => i.isCover)).toEqual([true, false, false]);
    expect(p.images[2].altText).toBe('Kitchen'); expect(p.saves).toBe(1);
  });
  it('rejects an incomplete or foreign order, cover or alt text', async () => {
    const p = () => prop([photo('a', { isCover: true }), photo('b')]);
    await expect(img.updateImageMeta(p(), { order: ['a'] }, owner)).rejects.toMatchObject({ status: 422 });
    await expect(img.updateImageMeta(p(), { order: ['a', 'a'] }, owner)).rejects.toMatchObject({ status: 422 });
    await expect(img.updateImageMeta(p(), { order: ['a', 'x'] }, owner)).rejects.toMatchObject({ status: 422 });
    await expect(img.updateImageMeta(p(), { coverId: 'x' }, owner)).rejects.toMatchObject({ status: 422 });
    await expect(img.updateImageMeta(p(), { altTexts: { x: 'hi' } }, owner)).rejects.toMatchObject({ status: 422 });
  });
  it('always leaves exactly one cover', async () => {
    const p = prop([photo('a'), photo('b')]); // none flagged
    await img.updateImageMeta(p, { altTexts: { a: 'x' } }, owner);
    expect(p.images.filter((i) => i.isCover)).toHaveLength(1); expect(p.images[0].isCover).toBe(true);
  });
});
