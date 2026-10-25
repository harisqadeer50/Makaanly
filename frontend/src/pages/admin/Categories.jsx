import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { adminApi } from '../../services/admin';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { PROPERTY_TYPES, labelOf } from '../../utils/propertyOptions';

export default function Categories() {
  usePageTitle('Property types');
  const toast = useToast(); const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin', 'categories'] }); qc.invalidateQueries({ queryKey: ['categories'] }); };

  const toggle = useMutation({ mutationFn: (c) => adminApi.updateCategory(c.key, { isActive: !c.isActive }), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  // Moving swaps the order numbers of two neighbours.
  const move = useMutation({
    mutationFn: async ({ a, b }) => { await adminApi.updateCategory(a.key, { sortOrder: b.sortOrder }); await adminApi.updateCategory(b.key, { sortOrder: a.sortOrder }); },
    onSuccess: refresh, onError: (e) => { toast.error(errorMessage(e)); refresh(); },
  });
  const rows = data?.categories || [];
  const busy = toggle.isPending || move.isPending;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">Property types</h1>
      <p className="mt-1 text-sm text-stone-500">Choose which types people can pick for new listings, and the order they appear in. Hiding a type does not affect listings that already use it.</p>
      <div className="mt-6">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? <Skeleton className="h-64" /> : (
          <ul className="divide-y divide-stone-100 rounded-card bg-white shadow-card">
            {rows.map((c, i) => (
              <li key={c.key} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 font-medium">{labelOf(PROPERTY_TYPES, c.key)}</span>
                <Badge tone={c.isActive ? 'green' : 'neutral'}>{c.isActive ? 'Offered' : 'Hidden'}</Badge>
                <Button size="sm" variant="ghost" disabled={busy || i === 0} aria-label={`Move ${labelOf(PROPERTY_TYPES, c.key)} up`} onClick={() => move.mutate({ a: c, b: rows[i - 1] })}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" disabled={busy || i === rows.length - 1} aria-label={`Move ${labelOf(PROPERTY_TYPES, c.key)} down`} onClick={() => move.mutate({ a: c, b: rows[i + 1] })}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => toggle.mutate(c)}>{c.isActive ? 'Hide' : 'Offer'}</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
