import { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

const Input = forwardRef(function Input({ label, error, hint, className, id, ...props }, ref) {
  const auto = useId();
  const inputId = id || auto;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-navy-800">{label}</label>}
      <input
        ref={ref} id={inputId} aria-invalid={!!error} aria-describedby={describedBy}
        className={cn(
          'h-11 w-full rounded-lg border bg-white px-3.5 text-sm placeholder:text-stone-500 focus:border-sage-500',
          error ? 'border-red-600' : 'border-stone-300',
        )}
        {...props}
      />
      {hint && !error && <p id={`${inputId}-hint`} className="mt-1 text-xs text-stone-500">{hint}</p>}
      {error && <p id={`${inputId}-err`} role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
});
export default Input;
