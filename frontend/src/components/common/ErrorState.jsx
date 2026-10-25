import { AlertTriangle } from 'lucide-react';
import Button from './Button';
export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-card border border-red-200 bg-red-50 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-red-700" aria-hidden="true" />
      <p className="max-w-md text-sm text-red-900">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
