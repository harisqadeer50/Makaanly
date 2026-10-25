import { cn } from '../../utils/cn';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import Skeleton from '../common/Skeleton';

// A table that scrolls sideways on small screens instead of squashing, with loading, empty and error states built in.
export default function DataTable({ columns, rows, rowKey = (r) => r.id, isLoading, isError, error, onRetry, empty, caption }) {
  if (isError) return <ErrorState message={error?.message} onRetry={onRetry} />;
  if (isLoading) return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!rows?.length) return empty || <EmptyState title="Nothing to show" />;
  return (
    <div className="overflow-x-auto rounded-card bg-white shadow-card">
      <table className="w-full min-w-[40rem] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn('px-4 py-3 font-medium', c.className)}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r) => <tr key={rowKey(r)} className="align-top">{columns.map((c) => <td key={c.key} className={cn('px-4 py-3', c.className)}>{c.render(r)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
