import { errorMessage } from './applyServerErrors';

// Applies a photo draft to the server, in a safe order:
//   1. upload new photos (so a live listing never drops below its minimum),
//   2. delete removed photos,
//   3. set order, cover and alt text in one request.
// It never throws. Failed items stay in the draft so saving again retries only what is left.
export async function syncImages({ propertyId, items, removedIds, coverKey, dirty, api, onItem = () => {}, onRemoved = () => {} }) {
  const failures = [];
  let latest = null;
  let uploads = 0;

  const serverIds = new Map(items.filter((i) => i.kind === 'server').map((i) => [i.key, i.id]));
  items.filter((i) => i.kind === 'local' && i.serverId).forEach((i) => serverIds.set(i.key, i.serverId));
  const known = new Set([...serverIds.values(), ...removedIds]);

  for (const item of items) {
    if (item.kind !== 'local' || serverIds.has(item.key)) continue;
    onItem(item.key, { status: 'uploading', progress: 0, error: null });
    try {
      const { property } = await api.uploadImage(propertyId, item.file, (progress) => onItem(item.key, { progress }));
      const created = property.images.find((i) => !known.has(i.id));
      if (!created) throw new Error('The server did not return the uploaded photo.');
      known.add(created.id);
      serverIds.set(item.key, created.id);
      latest = property;
      uploads += 1;
      onItem(item.key, { status: 'done', progress: 100, serverId: created.id });
    } catch (err) {
      failures.push({ key: item.key, error: err });
      onItem(item.key, { status: 'error', error: errorMessage(err) });
    }
  }

  // Only continue once every upload succeeded, so the order request below can list every photo.
  if (failures.length) return { ok: false, failures, property: latest };

  for (const id of removedIds) {
    try {
      latest = (await api.removeImage(propertyId, id)).property;
      onRemoved(id);
    } catch (err) {
      if (err?.status === 404) onRemoved(id); // already gone
      else failures.push({ id, error: err });
    }
  }
  if (failures.length) return { ok: false, failures, property: latest };

  if (items.length && (dirty || uploads > 0 || removedIds.length)) {
    try {
      const idOf = (i) => serverIds.get(i.key);
      const cover = items.find((i) => i.key === coverKey) || items[0];
      latest = (await api.updateImages(propertyId, {
        order: items.map(idOf),
        coverId: idOf(cover),
        altTexts: Object.fromEntries(items.map((i) => [idOf(i), (i.altText || '').trim()])),
      })).property;
    } catch (err) {
      failures.push({ meta: true, error: err });
      return { ok: false, failures, property: latest };
    }
  }
  return { ok: true, failures: [], property: latest };
}
