import { Home } from 'lucide-react';
export default function EmptyState({ icon: Icon = Home, title, description, action }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-sage-100 text-sage-600"><Icon className="h-6 w-6" aria-hidden="true" /></span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
