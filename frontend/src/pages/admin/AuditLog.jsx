import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { adminApi } from '../../services/admin';
import DataTable from '../../components/admin/DataTable';
import Input from '../../components/common/Input';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { Select } from '../../components/common/FormFields';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDay, formatTime } from '../../utils/datetime';

export const ACTION_LABELS = {
  'listing.create': 'Listing created', 'listing.update': 'Listing edited', 'listing.status': 'Listing status changed', 'listing.delete': 'Listing deleted', 'listing.images': 'Listing photos changed',
  'listing.approve': 'Listing approved', 'listing.reject': 'Listing rejected', 'listing.feature': 'Featured changed', 'user.suspend': 'User suspended', 'user.reactivate': 'User reactivated',
  'report.update': 'Report updated', 'verification.approve': 'Verification approved', 'verification.reject': 'Verification rejected', 'verification.revoke': 'Verification revoked',
  'verification.view_document': 'Document opened', 'category.update': 'Property type changed',
};
const TARGETS = ['property', 'user', 'report', 'verification', 'category'];

export default function AuditLog() {
  usePageTitle('Audit log');
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const f = { action: params.get('action') || '', targetType: params.get('targetType') || '', from: params.get('from') || '', to: params.get('to') || '' };
  const query = { page, limit: 25, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) };
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'audit', query], queryFn: () => adminApi.auditLogs(query), placeholderData: keepPreviousData });
  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); n.delete('page'); setParams(n); };

  const columns = [
    { key: 'when', header: 'When (Pakistan time)', render: (l) => <span className="whitespace-nowrap">{formatDay(l.createdAt)}, {formatTime(l.createdAt)}</span> },
    { key: 'actor', header: 'Who', render: (l) => l.actor.name },
    { key: 'action', header: 'What', render: (l) => <span className="whitespace-nowrap font-medium">{ACTION_LABELS[l.action] || l.action}</span> },
    { key: 'summary', header: 'Details', render: (l) => <div><p>{l.summary}</p>{l.meta?.reason && <p className="text-xs text-stone-500">Reason: {l.meta.reason}</p>}</div> },
  ];
  return (
    <div>
      <h1 className="text-3xl font-bold">Audit log</h1>
      <p className="mt-1 text-sm text-stone-500">A permanent record of administrator actions. Entries cannot be edited or deleted here.</p>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Select label="Action" value={f.action} onChange={(e) => update({ action: e.target.value })} placeholder="All actions" className="w-56" options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))} />
        <Select label="About" value={f.targetType} onChange={(e) => update({ targetType: e.target.value })} placeholder="Anything" className="w-40" options={TARGETS.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} />
        <Input label="From" type="date" value={f.from} onChange={(e) => update({ from: e.target.value })} className="w-40" />
        <Input label="To" type="date" value={f.to} onChange={(e) => update({ to: e.target.value })} className="w-40" error={f.from && f.to && f.from > f.to ? 'Before the start date' : undefined} />
      </div>
      <div className="mt-5"><DataTable caption="Audit log" columns={columns} rows={data?.logs} isLoading={isLoading} isError={isError} error={error} onRetry={refetch} empty={<EmptyState icon={ScrollText} title="No entries" description="Nothing matches these filters." />} /></div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => { const n = new URLSearchParams(params); p > 1 ? n.set('page', String(p)) : n.delete('page'); setParams(n); }} />
    </div>
  );
}
