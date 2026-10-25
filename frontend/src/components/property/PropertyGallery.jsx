import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import Modal from '../common/Modal';
import { ImagePlaceholder } from './PropertyCard';
import { cloudinaryUrl } from '../../utils/images';
import { cn } from '../../utils/cn';

export default function PropertyGallery({ images = [], title }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const count = images.length;
  const step = useCallback((d) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => {
    if (!open || count < 2) return undefined;
    const onKey = (e) => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, count, step]);

  if (!count) return <ImagePlaceholder className="aspect-[16/9] w-full rounded-card" />;
  const current = images[index];

  return (
    <div>
      <div className="relative overflow-hidden rounded-card bg-stone-100">
        <img src={cloudinaryUrl(current.url, { w: 1200, h: 750 })} alt={current.altText || `${title}, photo ${index + 1}`} className="aspect-[16/9] w-full object-cover" fetchpriority="high" />
        <button type="button" onClick={() => setOpen(true)} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-sm font-medium shadow">
          <Expand className="h-4 w-4" aria-hidden="true" />View full screen ({index + 1}/{count})
        </button>
        {count > 1 && (<>
          <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="Next photo" onClick={() => step(1)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow"><ChevronRight className="h-5 w-5" /></button>
        </>)}
      </div>
      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
                className={cn('block overflow-hidden rounded-lg border-2', i === index ? 'border-sage-500' : 'border-transparent')}>
                <img src={cloudinaryUrl(img.url, { w: 160, h: 110 })} alt="" loading="lazy" className="h-16 w-24 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`${title}: photo ${index + 1} of ${count}`} size="lg" hideTitle>
        <div className="relative bg-navy-900">
          <img src={cloudinaryUrl(current.url, { w: 1800 })} alt={current.altText || `${title}, photo ${index + 1}`} className="max-h-[85vh] w-full object-contain" />
          {count > 1 && (<>
            <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" aria-label="Next photo" onClick={() => step(1)} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95"><ChevronRight className="h-6 w-6" /></button>
          </>)}
        </div>
      </Modal>
    </div>
  );
}
