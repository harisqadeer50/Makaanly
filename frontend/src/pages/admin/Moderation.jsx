import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, ExternalLink, Flag, ImageOff } from 'lucide-react';
import { adminApi } from '../../services/admin';
import ReasonDialog from '../../components/admin/ReasonDialog';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import { Textarea } from '../../components/common/FormFields';
import { ImagePlaceholder } from '../../components/property/PropertyCard';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { cloudinaryUrl } from '../../utils/images';
import { formatPrice, locationLine, formatArea } from '../../utils/format';
import { timeAgo } from '../../utils/datetime';
import { PROPERTY_TYPES, labelOf } from '../../utils/propertyOptions';

export default function Moderation() {
  usePageTitle('Moderation queue');
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const toast = useToast(); const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'pending', page], queryFn: () => adminApi.pending({ page, limit: 10 }) });
  const done = (msg) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['properties'] }); setRejecting(null); setNote(''); };
  const fail = (e) => { toast.error(errorMessage(e)); setRejecting(null); qc.invalidateQueries({ queryKey: ['admin'] }); };
  const approve = useMutation({ mutationFn: (p) => adminApi.moderate(p.id, { decision: 'approve' }), onSuccess: done('Listing approved and published. The owner has been emailed.'), onError: fail });
  const reject = useMutation({ mutationFn: ({ p, reason }) => adminApi.moderate(p.id, { decision: 'reject', reason, ...(note.trim() && { note: note.trim() }) }), onSuccess: done('Listing rejected. The owner has been emailed the reason.'), onError: fail });

  return (
    <div>
      <h1 className="text-3xl font-bold">Moderation queue</h1>
      <p className="mt-1 text-sm text-stone-500">Listings waiting for review, oldest first. Approving publishes the listing; rejecting sends the owner your reason.</p>
      <div className="mt-6 space-y-4">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />) :
          !data.properties.length ? <EmptyState icon={CheckCircle2} title="The queue is empty" description="Nothing is waiting for review right now." /> :
            data.properties.map((p) => {
              const cover = p.images?.[0];
              return (
                <article key={p.id} className="grid gap-4 rounded-card bg-white p-4 shadow-card sm:grid-cols-[13rem_1fr]">
                  {cover ? <img src={cloudinaryUrl(cover.url, { w: 520, h: 390 })} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" /> : <ImagePlaceholder className="aspect-[4/3] w-full rounded-lg" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="navy">{p.purpose === 'rent' ? 'For rent' : 'For sale'}</Badge><Badge>{labelOf(PROPERTY_TYPES, p.propertyType)}</Badge>
                      <span className="font-mono text-xs text-stone-500">{p.referenceId}</span><span className="text-xs text-stone-500">submitted {timeAgo(p.updatedAt)}</span>
                      {p.openReports > 0 && <Badge tone="red"><Flag className="h-3 w-3" aria-hidden="true" />{p.openReports} open report{p.openReports > 1 ? 's' : ''}</Badge>}
                    </div>
                    <h2 className="mt-1.5 font-sans text-lg font-semibold">{p.title}</h2>
                    <p className="text-sm text-stone-600">{formatPrice(p)} · {locationLine(p.location)} · {formatArea(p.coveredArea || p.plotArea, p.areaUnit)}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-stone-700">{p.description}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-stone-600">
                      <span>{p.imageCount} photo{p.imageCount === 1 ? '' : 's'}</span>
                      {p.ownerInfo && <span>by <strong>{p.ownerInfo.name}</strong> ({p.ownerInfo.email}){p.ownerInfo.role === 'agent' ? ', agent' : ''}</span>}
                    </p>
                    {p.imageCount === 0 && <p role="note" className="mt-2 flex items-center gap-1.5 text-sm text-amber-800"><ImageOff className="h-4 w-4" aria-hidden="true" />This listing has no photos, so it cannot be approved. Reject it, or add a photo from Edit.</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="accent" loading={approve.isPending && approve.variables?.id === p.id} disabled={p.imageCount === 0 || approve.isPending || reject.isPending} onClick={() => approve.mutate(p)}><BadgeCheck className="h-4 w-4" aria-hidden="true" />Approve</Button>
                      <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => setRejecting(p)}>Reject…</Button>
                      <Button as={Link} to={`/admin/properties/${p.id}/edit`} size="sm" variant="ghost">Edit</Button>
                      <Button as={Link} to={`/properties/${p.slug}`} target="_blank" rel="noopener" size="sm" variant="ghost"><ExternalLink className="h-4 w-4" aria-hidden="true" />Preview</Button>
                    </div>
                  </div>
                </article>
              );
            })}
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => { const n = new URLSearchParams(params); p > 1 ? n.set('page', String(p)) : n.delete('page'); setParams(n); }} />

      <ReasonDialog open={!!rejecting} onClose={() => setRejecting(null)} loading={reject.isPending} danger confirmLabel="Reject listing" label="Reason for the owner"
        title="Reject this listing?" message={rejecting ? `“${rejecting.title}”. The owner will see this reason and can fix the listing and resubmit it.` : ''}
        onConfirm={(reason) => reject.mutate({ p: rejecting, reason })}>
        <Textarea label="Internal note (optional)" rows={2} maxLength={1000} hint="Only administrators can see this." value={note} onChange={(e) => setNote(e.target.value)} />
      </ReasonDialog>
    </div>
  );
}
