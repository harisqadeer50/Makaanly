import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { inquiriesApi } from '../../services/marketplace';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import { Select } from '../../components/common/FormFields';
import { usePageTitle } from '../../hooks/usePageTitle';
import { timeAgo } from '../../utils/datetime';
import { cn } from '../../utils/cn';

export const INQUIRY_TONES = { new: 'amber', read: 'neutral', replied: 'green', closed: 'neutral' };
export const INQUIRY_LABELS = { new: 'New', read: 'Read', replied: 'Replied', closed: 'Closed' };

export default function Inquiries() {
  usePageTitle('Inquiries');
  const { user } = useAuth();
  const canReceive = ['owner', 'agent', 'admin'].includes(user.role);
  const [params, setParams] = useSearchParams();
  const tab = canReceive && params.get('tab') !== 'sent' ? 'received' : 'sent';
  const status = params.get('status') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = { page, limit: 15, ...(status && { status }) };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inquiries', tab, query], queryFn: () => (tab === 'received' ? inquiriesApi.received(query) : inquiriesApi.sent(query)),
  });
  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };

  return (
    <div>
      <h1 className="text-3xl font-bold">Inquiries</h1>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        {canReceive ? (
          <div className="flex gap-2" role="tablist" aria-label="Inquiry direction">
            {[['received', 'Received'], ['sent', 'Sent']].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => update({ tab: id === 'received' ? '' : id, page: '', status: '' })}
                className={cn('rounded-full px-4 py-2 text-sm font-medium', tab === id ? 'bg-navy-900 text-white' : 'bg-white shadow-card hover:bg-stone-100')}>{label}</button>
            ))}
          </div>
        ) : <p className="text-sm text-stone-500">Messages you have sent to listers.</p>}
        <Select aria-label="Filter by status" value={status} onChange={(e) => update({ status: e.target.value, page: '' })} placeholder="All statuses" className="w-44"
          options={Object.entries(INQUIRY_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>

      <div className="mt-5 space-y-3">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />) :
          !data.inquiries.length ? (
            <EmptyState icon={MessageSquare} title={tab === 'received' ? 'No inquiries yet' : 'You have not sent any inquiries'}
              description={tab === 'received' ? 'When someone contacts you about a listing, it appears here.' : 'Open a property and use “Contact the lister” to start a conversation.'} />
          ) : data.inquiries.map((i) => (
            <Link key={i.id} to={`/dashboard/inquiries/${i.id}`} className={cn('flex gap-3 rounded-card bg-white p-4 shadow-card transition-shadow hover:shadow-lg', i.status === 'new' && tab === 'received' && 'border-l-4 border-amber-400')}>
              <Avatar name={i.counterpart.name} url={i.counterpart.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{i.counterpart.name}</p><Badge tone={INQUIRY_TONES[i.status]}>{INQUIRY_LABELS[i.status]}</Badge>
                  <span className="ml-auto text-xs text-stone-500">{timeAgo(i.lastActivityAt)}</span>
                </div>
                <p className="truncate text-sm text-stone-500">{i.property.title}</p>
                <p className="mt-1 line-clamp-1 text-sm text-stone-700">{i.replies.at(-1)?.message || i.message}</p>
              </div>
            </Link>
          ))}
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />
    </div>
  );
}
