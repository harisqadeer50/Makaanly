import { cn } from '../../utils/cn';
const tones = {
  neutral: 'bg-stone-100 text-stone-700',
  navy: 'bg-navy-900 text-white',
  green: 'bg-sage-100 text-sage-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};
export default function Badge({ tone = 'neutral', className, children }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}
