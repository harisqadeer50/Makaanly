import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const variants = {
  primary: 'bg-navy-900 text-white hover:bg-navy-700 disabled:bg-navy-300',
  accent: 'bg-sage-500 text-white hover:bg-sage-600 disabled:bg-sage-200',
  outline: 'border border-stone-300 bg-white text-navy-900 hover:bg-stone-100',
  ghost: 'text-navy-900 hover:bg-stone-100',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300',
};
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-sm', lg: 'h-12 px-6 text-base' };

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, as: Tag = 'button', ...props }, ref,
) {
  return (
    <Tag
      ref={ref}
      disabled={Tag === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Tag>
  );
});
export default Button;
