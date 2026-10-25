import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

let seq = 0;
const newKey = () => `local-${++seq}`;
const fromServer = (img) => ({ key: `server-${img.id}`, kind: 'server', id: img.id, url: img.url, altText: img.altText || '' });

function check(file) {
  if (!TYPES.includes(file.type)) return `${file.name}: only JPEG, PNG or WebP photos are allowed.`;
  if (file.size > MAX_PHOTO_BYTES) return `${file.name} is larger than ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

// Everything the person does to photos (add, remove, reorder, cover, alt text, replace) is staged here
// and only sent to the server when they save. Nothing is uploaded until the listing itself exists.
export function useImageDraft(initial = []) {
  const [items, setItems] = useState(() => initial.map(fromServer));
  const [coverKey, setCoverKey] = useState(() => { const c = initial.find((i) => i.isCover) || initial[0]; return c ? `server-${c.id}` : null; });
  const [removedIds, setRemovedIds] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState([]);
  const ref = useRef(items);
  ref.current = items;
  const urls = useRef(new Set());

  const preview = (file) => { const u = URL.createObjectURL(file); urls.current.add(u); return u; };
  const release = (u) => { if (u) { URL.revokeObjectURL(u); urls.current.delete(u); } };
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // A photo that already reached the server (or a local one that finished uploading) must also be deleted there.
  const serverIdOf = (it) => (it.kind === 'server' ? it.id : it.serverId);

  const addFiles = useCallback((fileList) => {
    const errs = []; const accepted = [];
    const room = MAX_PHOTOS - ref.current.length;
    [...fileList].forEach((f) => {
      const err = check(f);
      if (err) errs.push(err);
      else if (accepted.length >= room) errs.push(`Only ${MAX_PHOTOS} photos are allowed. Skipped ${f.name}.`);
      else accepted.push(f);
    });
    setErrors(errs);
    if (!accepted.length) return;
    const added = accepted.map((file) => ({ key: newKey(), kind: 'local', file, url: null, previewUrl: preview(file), altText: '', status: 'idle', progress: 0 }));
    setItems((cur) => [...cur, ...added]);
    setCoverKey((c) => c ?? added[0].key);
    setDirty(true);
  }, []);

  const remove = useCallback((key) => {
    const it = ref.current.find((i) => i.key === key);
    if (!it) return;
    const sid = serverIdOf(it);
    if (sid) setRemovedIds((r) => [...r, sid]);
    release(it.previewUrl);
    const rest = ref.current.filter((i) => i.key !== key);
    setItems(rest);
    setCoverKey((c) => (c === key ? rest[0]?.key ?? null : c));
    setErrors([]); setDirty(true);
  }, []);

  const replace = useCallback((key, file) => {
    const err = check(file);
    if (err) { setErrors([err]); return; }
    const it = ref.current.find((i) => i.key === key);
    if (!it) return;
    const sid = serverIdOf(it);
    if (sid) setRemovedIds((r) => [...r, sid]);
    release(it.previewUrl);
    const next = { key: newKey(), kind: 'local', file, url: null, previewUrl: preview(file), altText: it.altText, status: 'idle', progress: 0 };
    setItems((cur) => cur.map((i) => (i.key === key ? next : i)));
    setCoverKey((c) => (c === key ? next.key : c));
    setErrors([]); setDirty(true);
  }, []);

  const move = useCallback((key, delta) => {
    setItems((cur) => {
      const i = cur.findIndex((x) => x.key === key); const j = i + delta;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const copy = [...cur]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
    });
    setDirty(true);
  }, []);
  const setCover = useCallback((key) => { setCoverKey(key); setDirty(true); }, []);
  const setAlt = useCallback((key, text) => { setItems((cur) => cur.map((i) => (i.key === key ? { ...i, altText: text } : i))); setDirty(true); }, []);
  const patchItem = useCallback((key, patch) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i))), []);
  const markRemoved = useCallback((id) => setRemovedIds((r) => r.filter((x) => x !== id)), []);

  // After a fully successful save, replace the draft with what the server now holds.
  const adopt = useCallback((images) => {
    urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current.clear();
    const next = images.map(fromServer);
    setItems(next);
    setCoverKey((images.find((i) => i.isCover) || images[0]) ? `server-${(images.find((i) => i.isCover) || images[0]).id}` : null);
    setRemovedIds([]); setDirty(false); setErrors([]);
  }, []);

  return { items, coverKey, removedIds, dirty, errors, addFiles, remove, replace, move, setCover, setAlt, patchItem, markRemoved, adopt };
}
