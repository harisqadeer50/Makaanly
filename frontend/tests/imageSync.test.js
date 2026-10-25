import { describe, it, expect, vi } from 'vitest';
import { syncImages } from '../src/utils/imageSync';

const srv = (id, extra = {}) => ({ key: `server-${id}`, kind: 'server', id, altText: '', ...extra });
const loc = (key, extra = {}) => ({ key, kind: 'local', file: { name: key }, altText: '', status: 'idle', ...extra });

// A fake API that behaves like the server: tracks photos, assigns ids, enforces nothing else.
function fakeApi({ failUpload = [], failRemove = [] } = {}) {
  let images = []; let n = 0; const calls = [];
  const view = () => ({ property: { images: images.map((i) => ({ ...i })) } });
  return {
    calls, seed: (ids) => { images = ids.map((id) => ({ id })); },
    uploadImage: vi.fn(async (_p, file, onProgress) => {
      calls.push(`upload:${file.name}`); onProgress?.(50);
      if (failUpload.includes(file.name)) { const e = new Error('Upload failed'); e.errors = []; throw e; }
      n += 1; images.push({ id: `new${n}` }); return view();
    }),
    removeImage: vi.fn(async (_p, id) => {
      calls.push(`remove:${id}`);
      if (failRemove.includes(id)) throw Object.assign(new Error('nope'), { status: 409 });
      images = images.filter((i) => i.id !== id); return view();
    }),
    updateImages: vi.fn(async (_p, body) => { calls.push('meta'); images = body.order.map((id) => ({ id })); return view(); }),
  };
}
const run = (api, over) => syncImages({ propertyId: 'p1', items: [], removedIds: [], coverKey: null, dirty: false, api, ...over });

describe('syncImages', () => {
  it('uploads new photos, then sets order, cover and alt text mapped to the new server ids', async () => {
    const api = fakeApi(); api.seed(['a']);
    const patches = [];
    const items = [srv('a', { altText: 'Lounge' }), loc('l1', { altText: 'Kitchen' }), loc('l2')];
    const r = await run(api, { items, coverKey: 'l1', onItem: (k, p) => patches.push([k, p]) });
    expect(r.ok).toBe(true);
    expect(api.updateImages).toHaveBeenCalledWith('p1', { order: ['a', 'new1', 'new2'], coverId: 'new1', altTexts: { a: 'Lounge', new1: 'Kitchen', new2: '' } });
    expect(patches.some(([k, p]) => k === 'l1' && p.status === 'done' && p.serverId === 'new1')).toBe(true);
  });

  it('uploads before removing, so replacing the only photo of a live listing never leaves it empty', async () => {
    const api = fakeApi(); api.seed(['old']);
    await run(api, { items: [loc('l1')], removedIds: ['old'], coverKey: 'l1' });
    expect(api.calls).toEqual(['upload:l1', 'remove:old', 'meta']);
  });

  it('on a failed upload: stops before removals and the order request, reports the failure, and keeps the item for retry', async () => {
    const api = fakeApi({ failUpload: ['l2'] }); api.seed(['a']);
    const patches = [];
    const r = await run(api, { items: [srv('a'), loc('l1'), loc('l2')], removedIds: ['a-old'], coverKey: 'a', onItem: (k, p) => patches.push([k, p]) });
    expect(r.ok).toBe(false);
    expect(api.removeImage).not.toHaveBeenCalled(); expect(api.updateImages).not.toHaveBeenCalled();
    expect(patches.find(([k, p]) => k === 'l2' && p.status === 'error')[1].error).toBe('Upload failed');
    expect(patches.some(([k, p]) => k === 'l1' && p.status === 'done')).toBe(true);
  });

  it('retrying does not upload photos that already succeeded', async () => {
    const api = fakeApi(); api.seed(['a', 'uploaded-earlier']);
    const r = await run(api, { items: [srv('a'), loc('l1', { status: 'done', serverId: 'uploaded-earlier' }), loc('l2')], coverKey: 'a' });
    expect(r.ok).toBe(true);
    expect(api.uploadImage).toHaveBeenCalledTimes(1); // only l2
    expect(api.updateImages.mock.calls[0][1].order).toEqual(['a', 'uploaded-earlier', 'new1']);
  });

  it('reports a removal the server refused, without sending the order request', async () => {
    const api = fakeApi({ failRemove: ['x'] }); api.seed(['a', 'x']);
    const r = await run(api, { items: [srv('a')], removedIds: ['x'], coverKey: 'a' });
    expect(r.ok).toBe(false); expect(r.failures[0].id).toBe('x'); expect(api.updateImages).not.toHaveBeenCalled();
  });

  it('treats an already-deleted photo as removed', async () => {
    const api = fakeApi(); api.seed(['a']);
    api.removeImage.mockRejectedValueOnce(Object.assign(new Error('gone'), { status: 404 }));
    const removed = [];
    const r = await run(api, { items: [srv('a')], removedIds: ['ghost'], coverKey: 'a', onRemoved: (id) => removed.push(id) });
    expect(r.ok).toBe(true); expect(removed).toEqual(['ghost']);
  });

  it('makes no requests when nothing changed', async () => {
    const api = fakeApi(); api.seed(['a']);
    const r = await run(api, { items: [srv('a')], coverKey: 'a' });
    expect(r.ok).toBe(true); expect(api.calls).toEqual([]);
  });

  it('sends only the order request when the person just reordered', async () => {
    const api = fakeApi(); api.seed(['a', 'b']);
    await run(api, { items: [srv('b'), srv('a')], coverKey: 'b', dirty: true });
    expect(api.calls).toEqual(['meta']);
    expect(api.updateImages.mock.calls[0][1]).toMatchObject({ order: ['b', 'a'], coverId: 'b' });
  });
});
