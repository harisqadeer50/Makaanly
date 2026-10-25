import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-navy-900" />
      <path d="M7 16 16 8l9 8v9H7z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 25v-6h6v6" className="fill-sage-400" />
    </svg>
  );
}

export default function Logo({ light = false, className }) {
  return (
    <Link to="/" aria-label="Makaanly home" className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('font-display text-xl font-bold', light ? 'text-white' : 'text-navy-900')}>
        Makaanly
      </span>
    </Link>
  );
}
