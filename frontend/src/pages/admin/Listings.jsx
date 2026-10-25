import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Building2, Eye, Flag, Pencil, Plus, Search, Star } from 'lucide-react';
import { adminApi } from '../../services/admin';
import { propertiesApi } from '../../services/properties';
import DataTable from '../../components/admin/DataTable';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { Select } from '../../components/common/FormFields';
import { ConfirmDialog } from '../../components/common/Modal';
import { ImagePlaceholder } from '../../components/property/PropertyCard';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { cloudinaryUrl } from '../../utils/images';
import { formatDate, formatPrice, locationLine } from '../../utils/format';
import { CITIES } from '../../utils/locations';
import { STATUS_LABELS, STATUS_TONES } from '../../utils/propertyOptions';

// What an administrator may do from the list (the API enforces the real rules).
const QUICK = { draft: [['published', 'Publish']], paused: [['published', 'Publish']], published: [['paused', 'Pause']] };
const CAN_ARCHIVE = ['draft', 'pending_review', 'rejected', 'published', 'paused', 'sold', 'rented'];

export default function Listings() {
  usePageTitle('All listings');
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') || ''; const status = params.get('status') || ''; const city = params.get('city') || '';
  const query = { page, limit: 15, ...(q && { q }), ...(status && { status }), ...(city && { city }) };
  const toast = useToast(); const qc = useQueryClient();
  const [confirm, setConfirm] = useState(null); // { kind: 'archive' | 'delete', p }

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'properties', query], queryFn: () => adminApi.properties(query), placeholderData: keepPreviousData });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['properties'] }); };
  const fail = (e) => { toast.error(errorMessage(e)); setConfirm(null); };

  const setStatus = useMutation({ mutationFn: ({ p, to }) => propertiesApi.setStatus(p.id, to), onSuccess: () => { toast.success('Listing updated.'); refresh(); setConfirm(null); }, onError: fail });
  const feature = useMutation({ mutationFn: ({ p }) => adminApi.setFeatured(p.id, !p.isFeatured), onSuccess: (r) => { toast.success(r.property.isFeatured ? 'Listing is now featured.' : 'Listing is no longer featured.'); refresh(); }, onError: fail });
  const remove = useMutation({ mutationFn: ({ p }) => propertiesApi.remove(p.id), onSuccess: () => { toast.success('Listing deleted.'); refresh(); setConfirm(null); }, onError: fail });
  const busy = setStatus.isPending || feature.isPending || remove.isPending;

  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };

  const columns = [
    { key: 'listing', header: 'Listing', render: (p) => (
      <div className="flex min-w-[15rem] gap-3">
        {p.images?.[0] ? <img src={cloudinaryUrl(p.images[0].url, { w: 160, h: 120 })} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-md object-cover" /> : <ImagePlaceholder className="h-14 w-20 shrink-0 rounded-md" />}
        <div className="min-w-0"><Link to={`/properties/${p.slug}`} className="line-clamp-2 font-medium hover:underline">{p.title}</Link>
          <p className="font-mono text-xs text-stone-500">{p.referenceId} · {locationLine(p.location)}</p></div>
      </div>) },
    { key: 'owner', header: 'Owner', render: (p) => (p.ownerInfo ? <div><p className="font-medium">{p.ownerInfo.name}</p><p className="text-xs text-stone-500">{p.ownerInfo.email}</p></div> : '—') },
    { key: 'status', header: 'Status', render: (p) => (
      <div className="flex flex-wrap gap-1"><Badge tone={STATUS_TONES[p.status]}>{STATUS_LABELS[p.status]}</Badge>{p.isFeatured && <Badge tone="green">Featured</Badge>}
        {p.openReports > 0 && <Badge tone="red"><Flag className="h-3 w-3" aria-hidden="true" />{p.openReports} report{p.openReports > 1 ? 's' : ''}</Badge>}</div>) },
    { key: 'price', header: 'Price', render: (p) => <span className="whitespace-nowrap">{formatPrice(p)}</span> },
    { key: 'updated', header: 'Updated', render: (p) => <span className="whitespace-nowrap text-stone-500">{formatDate(p.updatedAt)}</span> },
    { key: 'actions', header: 'Actions', render: (p) => (
      <div className="flex min-w-[12rem] flex-wrap gap-1.5">
        <Button as={Link} to={`/admin/properties/${p.id}/edit`} size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</Button>
        <Button as={Link} to={`/properties/${p.slug}`} size="sm" variant="ghost" aria-label={`View ${p.title}`}><Eye className="h-3.5 w-3.5" aria-hidden="true" /></Button>
        {p.status === 'pending_review' && <Button as={Link} to="/admin/moderation" size="sm" variant="outline">Review</Button>}
        {p.status === 'published' && <Button size="sm" variant="outline" disabled={busy} onClick={() => feature.mutate({ p })} aria-pressed={p.isFeatured}><Star className="h-3.5 w-3.5" aria-hidden="true" />{p.isFeatured ? 'Unfeature' : 'Feature'}</Button>}
        {(QUICK[p.status] || []).map(([to, label]) => <Button key={to} size="sm" variant="outline" disabled={busy} onClick={() => setStatus.mutate({ p, to })}>{label}</Button>)}
        {CAN_ARCHIVE.includes(p.status) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ kind: 'archive', p })}>Archive</Button>}
        <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" disabled={busy} onClick={() => setConfirm({ kind: 'delete', p })}>Delete</Button>
      </div>) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4"><h1 className="text-3xl font-bold">All listings</h1><Button as={Link} to="/admin/properties/new" variant="accent"><Plus className="h-4 w-4" aria-hidden="true" />Add listing</Button></div>
      <form role="search" className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); update({ q: new FormData(e.target).get('q').trim(), page: '' }); }}>
        <div className="relative min-w-[14rem] flex-1"><label htmlFor="adm-q" className="sr-only">Search listings</label><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <input id="adm-q" name="q" defaultValue={q} key={q} type="search" placeholder="Title, reference ID or address slug" className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm focus:border-sage-500" /></div>
        <Select aria-label="Status" value={status} onChange={(e) => update({ status: e.target.value, page: '' })} placeholder="All statuses" className="w-44" options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
        <Select aria-label="City" value={city} onChange={(e) => update({ city: e.target.value, page: '' })} placeholder="All cities" className="w-40" options={CITIES.map((c) => ({ value: c.name, label: c.name }))} />
        <Button type="submit">Search</Button>
      </form>
      <div className="mt-5">
        <DataTable caption="Listings" columns={columns} rows={data?.properties} isLoading={isLoading} isError={isError} error={error} onRetry={refetch}
          empty={<EmptyState icon={Building2} title="No listings match" description="Try a different search or filter." />} />
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />

      <ConfirmDialog open={confirm?.kind === 'archive'} onClose={() => setConfirm(null)} loading={setStatus.isPending} title="Archive this listing?" confirmLabel="Archive"
        message={`“${confirm?.p.title}” is removed from public search and can no longer be edited by its owner.`} onConfirm={() => setStatus.mutate({ p: confirm.p, to: 'archived' })} />
      <ConfirmDialog open={confirm?.kind === 'delete'} onClose={() => setConfirm(null)} loading={remove.isPending} danger title="Delete this listing permanently?" confirmLabel="Delete listing"
        message={`“${confirm?.p.title}” and its photos will be deleted for good. This cannot be undone. To keep a record, archive it instead.`} onConfirm={() => remove.mutate({ p: confirm.p })} />
    </div>
  );
}
