import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, FileText, ExternalLink } from 'lucide-react';
import { adminApi } from '../../services/admin';
import ReasonDialog from '../../components/admin/ReasonDialog';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { formatDay, formatTime } from '../../utils/datetime';
import { cn } from '../../utils/cn';

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['revoked', 'Revoked']];
const TONES = { pending: 'amber', approved: 'green', rejected: 'red', revoked: 'neutral' };
const size = (b) => (b ? `${Math.max(1, Math.round(b / 1024))} KB` : '');

export default function Verifications() {
  usePageTitle('Verification requests');
  const [params, setParams] = useSearchParams();
  const status = TABS.some(([v]) => v === params.get('status')) ? params.get('status') : 'pending';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const toast = useToast(); const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // { kind: 'approve' | 'reject' | 'revoke', v }
  const [links, setLinks] = useState({}); // docId -> { url, expiresAt }

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'verifications', status, page], queryFn: () => adminApi.verifications({ status, page, limit: 10 }) });
  const finish = (msg) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['properties'] }); setDialog(null); };
  const fail = (e) => { toast.error(errorMessage(e)); setDialog(null); qc.invalidateQueries({ queryKey: ['admin'] }); };
  const decide = useMutation({ mutationFn: ({ v, body }) => adminApi.decideVerification(v.id, body), onSuccess: (_r, vars) => finish(vars.body.decision === 'approve' ? 'Approved. The documents have been deleted.' : vars.body.decision === 'reject' ? 'Rejected. The documents have been deleted.' : 'Verification revoked.')(), onError: fail });

  const open = async (v, doc) => {
    const win = window.open('about:blank', '_blank'); // opened first, so the browser treats it as the result of the click
    try {
      const link = await adminApi.documentLink(v.id, doc.id);
      setLinks((l) => ({ ...l, [doc.id]: link }));
      if (win) { win.opener = null; win.location.href = link.url; }
    } catch (e) { win?.close(); toast.error(errorMessage(e)); }
  };
  const go = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };

  return (
    <div>
      <h1 className="text-3xl font-bold">Verification requests</h1>
      <p className="mt-1 text-sm text-stone-500">Documents are private. Links expire after 5 minutes, opening one is logged, and the files are deleted when you decide.</p>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Request status">
        {TABS.map(([v, label]) => <button key={v} type="button" role="tab" aria-selected={status === v} onClick={() => go({ status: v === 'pending' ? '' : v, page: '' })}
          className={cn('rounded-full px-4 py-2 text-sm font-medium', status === v ? 'bg-navy-900 text-white' : 'bg-white shadow-card hover:bg-stone-100')}>{label}</button>)}
      </div>

      <div className="mt-5 space-y-3">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? [0, 1].map((i) => <Skeleton key={i} className="h-40" />) :
          !data.verifications.length ? <EmptyState icon={BadgeCheck} title="No requests here" description={status === 'pending' ? 'Nobody is waiting for verification.' : 'Nothing to show for this status.'} /> :
            data.verifications.map((v) => (
              <article key={v.id} className="rounded-card bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3"><Avatar name={v.user?.name} size="h-11 w-11" />
                    <div><p className="font-semibold">{v.user?.name || 'Deleted account'}</p><p className="text-sm text-stone-500">{v.user?.email} · applying as {v.verificationType === 'agent' ? 'an agent' : 'an owner'}</p></div></div>
                  <div className="text-right"><Badge tone={TONES[v.status]}>{v.status[0].toUpperCase() + v.status.slice(1)}</Badge><p className="mt-1 text-xs text-stone-500">{formatDay(v.submittedAt)}, {formatTime(v.submittedAt)}</p></div>
                </div>
                {v.message && <p className="mt-3 whitespace-pre-line text-sm text-stone-700">“{v.message}”</p>}
                {v.status === 'pending' ? (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Documents">
                    {v.documents.map((d) => (
                      <li key={d.id}>
                        <Button size="sm" variant="outline" onClick={() => open(v, d)}><FileText className="h-4 w-4" aria-hidden="true" />{d.originalName || 'Document'} <span className="text-stone-500">({d.format.toUpperCase()}, {size(d.bytes)})</span></Button>
                        {links[d.id] && <a href={links[d.id].url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-sage-600 underline"><ExternalLink className="h-3 w-3" aria-hidden="true" />Open link</a>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-xs text-stone-500">{v.documentCount} document{v.documentCount === 1 ? ' was' : 's were'} reviewed and deleted.{v.reviewedBy && ` Decided by ${v.reviewedBy}.`}</p>}
                {v.rejectionReason && <p className="mt-2 rounded-md bg-stone-50 px-3 py-2 text-sm"><strong>Reason:</strong> {v.rejectionReason}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.status === 'pending' && <><Button size="sm" variant="accent" disabled={decide.isPending} onClick={() => setDialog({ kind: 'approve', v })}><BadgeCheck className="h-4 w-4" aria-hidden="true" />Approve</Button><Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'reject', v })}>Reject…</Button></>}
                  {v.status === 'approved' && <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'revoke', v })}>Revoke…</Button>}
                </div>
              </article>
            ))}
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => go({ page: p > 1 ? String(p) : '' })} />

      <ConfirmDialog open={dialog?.kind === 'approve'} onClose={() => setDialog(null)} loading={decide.isPending} title="Approve this verification?" confirmLabel="Approve"
        message={`${dialog?.v.user?.name ?? 'This person'} gets a verified badge on their profile and listings. Their documents are deleted.`} onConfirm={() => decide.mutate({ v: dialog.v, body: { decision: 'approve' } })} />
      <ReasonDialog open={dialog?.kind === 'reject'} onClose={() => setDialog(null)} loading={decide.isPending} danger confirmLabel="Reject request" label="Reason (sent to the applicant)"
        title="Reject this request?" message="The documents are deleted and the applicant can apply again." onConfirm={(reason) => decide.mutate({ v: dialog.v, body: { decision: 'reject', reason } })} />
      <ReasonDialog open={dialog?.kind === 'revoke'} onClose={() => setDialog(null)} loading={decide.isPending} danger confirmLabel="Revoke verification" label="Reason (sent to the person)"
        title="Revoke verified status?" message="The verified badge is removed from their profile and listings." onConfirm={(reason) => decide.mutate({ v: dialog.v, body: { decision: 'revoke', reason } })} />
    </div>
  );
}
