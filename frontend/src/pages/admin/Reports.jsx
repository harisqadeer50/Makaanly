import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { adminApi } from '../../services/admin';
import ReasonDialog from '../../components/admin/ReasonDialog';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import { Select } from '../../components/common/FormFields';
import { REPORT_REASONS } from '../../components/marketplace/ReportModal';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { formatDay, formatTime } from '../../utils/datetime';
import { STATUS_LABELS, STATUS_TONES } from '../../utils/propertyOptions';
import { cn } from '../../utils/cn';

const TABS = [['open', 'Open'], ['under_review', 'Under review'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']];
const reasonLabel = (r) => REPORT_REASONS.find(([v]) => v === r)?.[1] || r;
const when = (iso) => `${formatDay(iso)}, ${formatTime(iso)}`;

export default function Reports() {
  usePageTitle('Reports');
  const [params, setParams] = useSearchParams();
  const status = TABS.some(([v]) => v === params.get('status')) ? params.get('status') : 'open';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const toast = useToast(); const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // { kind: 'resolve' | 'dismiss', report }
  const [action, setAction] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'reports', status, page], queryFn: () => adminApi.reports({ status, page, limit: 10 }) });
  const finish = (msg) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['properties'] }); setDialog(null); setAction(''); };
  const fail = (e) => { toast.error(errorMessage(e)); setDialog(null); qc.invalidateQueries({ queryKey: ['admin'] }); };
  const update = useMutation({ mutationFn: ({ r, body }) => adminApi.updateReport(r.id, body), onSuccess: finish('Report updated.'), onError: fail });
  const go = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };

  return (
    <div>
      <h1 className="text-3xl font-bold">Reports</h1>
      <p className="mt-1 text-sm text-stone-500">Listings reported by signed-in users. Reporters are never shown to the lister.</p>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Report status">
        {TABS.map(([v, label]) => <button key={v} type="button" role="tab" aria-selected={status === v} onClick={() => go({ status: v === 'open' ? '' : v, page: '' })}
          className={cn('rounded-full px-4 py-2 text-sm font-medium', status === v ? 'bg-navy-900 text-white' : 'bg-white shadow-card hover:bg-stone-100')}>{label}</button>)}
      </div>

      <div className="mt-5 space-y-3">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />) :
          !data.reports.length ? <EmptyState icon={Flag} title={status === 'open' ? 'No open reports' : 'Nothing here'} description="Reports appear here when people flag a listing." /> :
            data.reports.map((r) => (
              <article key={r.id} className="rounded-card bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="red">{reasonLabel(r.reason)}</Badge><span className="text-xs text-stone-500">{when(r.createdAt)}</span></div>
                <p className="mt-2 font-semibold">
                  {r.property.slug ? <Link to={`/properties/${r.property.slug}`} className="hover:underline">{r.property.title}</Link> : r.property.title}
                  <Badge tone={STATUS_TONES[r.property.status] || 'neutral'} className="ml-2 align-middle">{STATUS_LABELS[r.property.status] || 'Removed'}</Badge>
                </p>
                {r.description && <p className="mt-1 whitespace-pre-line text-sm text-stone-700">“{r.description}”</p>}
                {r.reporter && <p className="mt-1 text-xs text-stone-500">Reported by {r.reporter.name} ({r.reporter.email})</p>}
                {r.resolution && <p className="mt-2 rounded-md bg-stone-50 px-3 py-2 text-sm"><strong>Outcome:</strong> {r.resolution}{r.reviewedBy && <span className="text-stone-500"> · {r.reviewedBy}</span>}</p>}
                {['open', 'under_review'].includes(r.status) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === 'open' && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ r, body: { status: 'under_review' } })}>Start review</Button>}
                    <Button size="sm" variant="primary" onClick={() => setDialog({ kind: 'resolve', report: r })}>Resolve…</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'dismiss', report: r })}>Dismiss…</Button>
                  </div>
                )}
              </article>
            ))}
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => go({ page: p > 1 ? String(p) : '' })} />

      <ReasonDialog open={dialog?.kind === 'resolve'} onClose={() => { setDialog(null); setAction(''); }} loading={update.isPending} min={3} label="Outcome note" confirmLabel="Resolve report"
        title="Resolve this report" message={dialog ? `“${dialog.report.property.title}”. Describe what you found and what you did.` : ''}
        onConfirm={(resolution) => update.mutate({ r: dialog.report, body: { status: 'resolved', resolution, ...(action && { propertyAction: action }) } })}>
        <Select label="What should happen to the listing?" value={action} onChange={(e) => setAction(e.target.value)} placeholder="Leave it as it is"
          options={[{ value: 'pause', label: 'Pause it (hide it from the public)' }, { value: 'reject', label: 'Reject it (the note is sent to the owner as the reason)' }]}
          hint="Only a published listing can be paused or rejected." />
      </ReasonDialog>
      <ReasonDialog open={dialog?.kind === 'dismiss'} onClose={() => setDialog(null)} loading={update.isPending} min={3} label="Why is this not a problem?" confirmLabel="Dismiss report"
        title="Dismiss this report" onConfirm={(resolution) => update.mutate({ r: dialog.report, body: { status: 'dismissed', resolution } })} />
    </div>
  );
}
