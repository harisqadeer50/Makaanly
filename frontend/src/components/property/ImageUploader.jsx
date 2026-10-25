import { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, RefreshCw, Star, Trash2, TriangleAlert } from 'lucide-react';
import Button from '../common/Button';
import { cloudinaryUrl } from '../../utils/images';
import { MAX_PHOTOS } from '../../hooks/useImageDraft';
import { cn } from '../../utils/cn';

const ACCEPT = 'image/jpeg,image/png,image/webp';

function Tile({ it, index, count, isCover, draft, busy, onRetry }) {
  const src = it.previewUrl || cloudinaryUrl(it.url, { w: 480, h: 360 });
  const label = `photo ${index + 1}`;
  const iconBtn = 'grid h-9 w-9 place-items-center rounded-md bg-white text-navy-900 shadow hover:bg-stone-100 disabled:opacity-40';
  return (
    <li className={cn('overflow-hidden rounded-card border bg-white', isCover ? 'border-sage-500' : 'border-stone-200')}>
      <div className="relative aspect-[4/3] bg-stone-100">
        <img src={src} alt={it.altText || `Preview of ${label}`} className={cn('h-full w-full object-cover', it.status === 'uploading' && 'opacity-60')} />
        {isCover && <span className="absolute left-2 top-2 rounded-full bg-sage-600 px-2.5 py-0.5 text-xs font-medium text-white">Cover</span>}
        {it.status === 'uploading' && (
          <div className="absolute inset-x-2 bottom-2" role="progressbar" aria-label={`Uploading ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={it.progress}>
            <div className="h-2 overflow-hidden rounded-full bg-white/80"><div className="h-full bg-sage-500 transition-all" style={{ width: `${it.progress}%` }} /></div>
          </div>
        )}
        {it.status === 'done' && <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2 py-0.5 text-xs text-sage-700">Uploaded</span>}
      </div>
      <div className="space-y-2 p-2.5">
        {it.status === 'error' && (
          <div role="alert" className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{it.error}</span>
            <button type="button" onClick={onRetry} disabled={busy} className="font-medium underline disabled:opacity-50">Retry</button>
          </div>
        )}
        <input type="text" value={it.altText} maxLength={160} disabled={busy} onChange={(e) => draft.setAlt(it.key, e.target.value)}
          aria-label={`Description of ${label} (optional)`} placeholder="Describe this photo (optional)"
          className="h-9 w-full rounded-md border border-stone-300 px-2.5 text-xs focus:border-sage-500" />
        <div className="flex items-center gap-1.5">
          <button type="button" className={iconBtn} disabled={busy || index === 0} onClick={() => draft.move(it.key, -1)} aria-label={`Move ${label} earlier`}><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" className={iconBtn} disabled={busy || index === count - 1} onClick={() => draft.move(it.key, 1)} aria-label={`Move ${label} later`}><ArrowRight className="h-4 w-4" /></button>
          <button type="button" className={iconBtn} disabled={busy || isCover} onClick={() => draft.setCover(it.key)} aria-label={isCover ? `${label} is the cover` : `Make ${label} the cover`}><Star className={cn('h-4 w-4', isCover && 'fill-sage-500 text-sage-500')} /></button>
          <label className={cn(iconBtn, 'cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-sage-500', busy && 'pointer-events-none opacity-40')}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Replace {label}</span>
            <input type="file" accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => { if (e.target.files[0]) draft.replace(it.key, e.target.files[0]); e.target.value = ''; }} />
          </label>
          <button type="button" className={cn(iconBtn, 'ml-auto text-red-700')} disabled={busy} onClick={() => draft.remove(it.key)} aria-label={`Remove ${label}`}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </li>
  );
}

export default function ImageUploader({ draft, busy = false, onRetry }) {
  const inputId = useId();
  const [over, setOver] = useState(false);
  const { items, coverKey, errors } = draft;
  const full = items.length >= MAX_PHOTOS;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
        <p className="text-sm text-stone-500" aria-live="polite">{items.length} of {MAX_PHOTOS}</p>
      </div>
      <p className="mt-1 text-sm text-stone-500">Add at least one photo to submit for review. The cover photo appears in search results. Use the arrows to reorder.</p>

      <label htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); if (!full && !busy) setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!full && !busy) draft.addFiles(e.dataTransfer.files); }}
        className={cn('mt-4 flex cursor-pointer flex-col items-center rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-sage-500',
          over ? 'border-sage-500 bg-sage-50' : 'border-stone-300 bg-stone-50 hover:bg-stone-100', (full || busy) && 'pointer-events-none opacity-50')}>
        <ImagePlus className="h-8 w-8 text-sage-600" aria-hidden="true" />
        <span className="mt-2 text-sm font-medium">{full ? 'Photo limit reached' : 'Drag photos here or browse'}</span>
        <span className="text-xs text-stone-500">JPEG, PNG or WebP, up to 5 MB each</span>
        <input id={inputId} type="file" accept={ACCEPT} multiple className="sr-only" disabled={full || busy}
          onChange={(e) => { draft.addFiles(e.target.files); e.target.value = ''; }} />
      </label>

      {errors.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}

      {items.length > 0 && (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {items.map((it, i) => <Tile key={it.key} it={it} index={i} count={items.length} isCover={it.key === coverKey} draft={draft} busy={busy} onRetry={onRetry} />)}
        </ul>
      )}
    </div>
  );
}
