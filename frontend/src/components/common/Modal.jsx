import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import Button from './Button';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, size = 'md', hideTitle = false, sheet = false }) {
  const panel = useRef(null);
  const titleId = useId();
  // Callers usually pass a new onClose on every render. Keeping it in a ref means the effect below runs only when the
  // dialog opens or closes, so typing in a field never pulls focus back to the top of the dialog.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    document.body.style.overflow = 'hidden';
    (panel.current?.querySelector('input:not([type=hidden]),textarea,select') || panel.current?.querySelector(FOCUSABLE))?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const items = [...panel.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; previous?.focus?.(); };
  }, [open]);

  if (!open) return null;
  return (
    <div className={cn('fixed inset-0 z-50', sheet ? 'flex items-end justify-center sm:items-center sm:p-4' : 'grid place-items-center p-4')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-navy-900/60" onClick={onClose} />
      <div ref={panel} className={cn('relative w-full overflow-auto bg-white shadow-xl', sheet ? 'max-h-[92vh] rounded-t-card sm:max-h-[90vh] sm:rounded-card' : 'max-h-[90vh] rounded-card', size === 'lg' ? 'max-w-5xl' : 'max-w-md')}>
        <div className={cn('flex items-center justify-between gap-4 px-5 pt-5', hideTitle && 'absolute right-3 top-3 z-10 p-0')}>
          <h2 id={titleId} className={cn('text-lg font-semibold', hideTitle && 'sr-only')}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/90 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>
        <div className={hideTitle ? '' : 'p-5'}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-stone-700">{message}</p>
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
