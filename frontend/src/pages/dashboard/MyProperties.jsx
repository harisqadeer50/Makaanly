import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Eye, Heart, MessageSquare } from 'lucide-react';
import { propertiesApi } from '../../services/properties';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import { Select } from '../../components/common/FormFields';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { formatPrice, locationLine } from '../../utils/format';
import { cloudinaryUrl } from '../../utils/images';
import { errorMessage } from '../../utils/applyServerErrors';
import { ImagePlaceholder } from '../../components/property/PropertyCard';
import { STATUS_LABELS, STATUS_TONES } from '../../utils/propertyOptions';

// Mirrors backend/src/utils/propertyStatus.js (the API enforces the real rules).
const ACTIONS = {
  draft: [['pending_review', 'Submit for review']],
  pending_review: [['draft', 'Withdraw']],
  rejected: [['pending_review', 'Resubmit']],
  published: [['paused', 'Pause'], ['SOLD', 'Mark as sold/rented'], ['archived', 'Archive']],
  paused: [['published', 'Reactivate'], ['archived', 'Archive']],
  sold: [['archived', 'Archive']],
  rented: [['archived', 'Archive']],
  archived: [],
};

function Thumb({ property }) {
  const cover = property.images?.[0];
  return cover
    ? <img src={cloudinaryUrl(cover.url, { w: 224, h: 160 })} alt="" loading="lazy" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
    : <ImagePlaceholder className="h-20 w-28 shrink-0 rounded-lg" />;
}

export default function MyProperties() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') || '';
  const toast = useToast();
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(null);
  const query = { page, limit: 10, ...(status && { status }) };

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['properties', 'mine', query], queryFn: () => propertiesApi.mine(query) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['properties'] });

  const setStatus = useMutation({
    mutationFn: ({ id, to }) => propertiesApi.setStatus(id, to),
    onSuccess: () => { toast.success('Listing updated.'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id) => propertiesApi.remove(id),
    onSuccess: (r) => { toast.success(r.deleted ? 'Listing deleted.' : 'Listing archived.'); setPendingDelete(null); refresh(); },
    onError: (err) => { toast.error(err.message); setPendingDelete(null); },
  });

  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };
  const run = (p, to) => setStatus.mutate({ id: p.id, to: to === 'SOLD' ? (p.purpose === 'rent' ? 'rented' : 'sold') : to });
  const deleting = pendingDelete && ['draft', 'rejected'].includes(pendingDelete.status);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">My properties</h1>
        <div className="flex items-end gap-3">
          <Select label="Status" value={status} onChange={(e) => update({ status: e.target.value, page: '' })} placeholder="All statuses"
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} className="w-44" />
          <Button as={Link} to="/dashboard/properties/new" variant="accent">Add property</Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />) :
          !data.properties.length ? (
            <EmptyState icon={Building2} title={status ? 'No listings with this status' : 'You have no listings yet'} description="Create your first listing. It only takes a few minutes."
              action={<Button as={Link} to="/dashboard/properties/new" variant="accent">Add property</Button>} />
          ) : data.properties.map((p) => (
            <article key={p.id} className="rounded-card bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                <Thumb property={p} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONES[p.status]}>{STATUS_LABELS[p.status]}</Badge><span className="font-mono text-xs text-stone-500">{p.referenceId}</span></div>
                  <h2 className="mt-1.5 truncate font-sans text-base font-semibold">{p.title}</h2>
                  <p className="text-sm text-stone-500">{locationLine(p.location)} · {formatPrice(p)}</p>
                  {p.stats && (
                    <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-stone-500" aria-label="Listing statistics">
                      <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{p.stats.views} view{p.stats.views === 1 ? '' : 's'}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden="true" />{p.stats.favorites} saved</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />{p.stats.inquiries} inquir{p.stats.inquiries === 1 ? 'y' : 'ies'}</span>
                    </p>
                  )}
                  {p.status === 'rejected' && p.rejectionReason && <p role="note" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900"><strong>Rejected:</strong> {p.rejectionReason}</p>}
                </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button as={Link} to={`/properties/${p.slug}`} variant="ghost" size="sm"><Eye className="h-4 w-4" aria-hidden="true" />{p.status === 'published' ? 'View' : 'Preview'}</Button>
                  {!['sold', 'rented', 'archived'].includes(p.status) && <Button as={Link} to={`/dashboard/properties/${p.id}/edit`} variant="outline" size="sm"><Pencil className="h-4 w-4" aria-hidden="true" />Edit</Button>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                {ACTIONS[p.status].map(([to, label]) => <Button key={to} size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => run(p, to)}>{label}</Button>)}
                <Button size="sm" variant="ghost" className="ml-auto text-red-700 hover:bg-red-50" onClick={() => setPendingDelete(p)}>{['draft', 'rejected'].includes(p.status) ? 'Delete' : 'Archive'}</Button>
              </div>
            </article>
          ))}
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />

      <ConfirmDialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} danger loading={remove.isPending}
        title={deleting ? 'Delete this listing?' : 'Archive this listing?'} confirmLabel={deleting ? 'Delete' : 'Archive'}
        message={deleting ? 'This permanently deletes the listing. This cannot be undone.' : 'The listing will be removed from public search. You can no longer edit it.'}
        onConfirm={() => remove.mutate(pendingDelete.id)} />
    </div>
  );
}
