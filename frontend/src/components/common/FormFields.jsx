import { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

const base = 'w-full rounded-lg border bg-white px-3.5 text-sm focus:border-sage-500';
function Wrap({ label, error, hint, id, className, children }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy-800">{label}</label>}
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
const aria = (id, error, hint) => ({ 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined });

export const Select = forwardRef(function Select({ label, error, hint, options, placeholder, className, id, ...props }, ref) {
  const auto = useId(); const sid = id || auto;
  return (
    <Wrap label={label} error={error} hint={hint} id={sid} className={className}>
      <select ref={ref} id={sid} {...aria(sid, error, hint)} className={cn(base, 'h-11', error ? 'border-red-600' : 'border-stone-300')} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Wrap>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, className, id, rows = 6, ...props }, ref) {
  const auto = useId(); const tid = id || auto;
  return (
    <Wrap label={label} error={error} hint={hint} id={tid} className={className}>
      <textarea ref={ref} id={tid} rows={rows} {...aria(tid, error, hint)} className={cn(base, 'py-2.5', error ? 'border-red-600' : 'border-stone-300')} {...props} />
    </Wrap>
  );
});
