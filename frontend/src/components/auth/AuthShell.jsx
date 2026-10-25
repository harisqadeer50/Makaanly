import { AlertCircle } from 'lucide-react';
import Logo from '../common/Logo';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="rounded-card bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <p className="mt-5 text-center text-sm text-stone-500">{footer}</p>}
      </div>
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{message}</span>
    </div>
  );
}
