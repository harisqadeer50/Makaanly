import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { BadgeCheck, Bell, Building2, CalendarDays, Flag, MessageSquare } from 'lucide-react';
import { notificationsApi } from '../../services/marketplace';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { timeAgo } from '../../utils/datetime';
import { cn } from '../../utils/cn';

const ICONS = { inquiry: MessageSquare, appointment: CalendarDays, listing: Building2, report: Flag, verification: BadgeCheck };
const iconFor = (type) => ICONS[type.split('.')[0]] || Bell;

export default function Notifications() {
  usePageTitle('Notifications');
  const [params, setParams] = useSearchParams();
  const unread = params.get('unread') === 'true';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = { page, limit: 20, ...(unread && { unread: true }) };
  const toast = useToast(); const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['notifications', 'list', query], queryFn: () => notificationsApi.list(query), placeholderData: keepPreviousData });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: (id) => notificationsApi.markRead(id), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: () => { toast.success('All notifications marked as read.'); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };
  const unreadTotal = data?.meta?.unread ?? 0;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Notifications</h1><p className="mt-1 text-sm text-stone-500" aria-live="polite">{data ? (unreadTotal ? `${unreadTotal} unread` : 'You are all caught up') : '\u00a0'}</p></div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-sage-500" checked={unread} onChange={(e) => update({ unread: e.target.checked ? 'true' : '', page: '' })} />Unread only</label>
          <Button variant="outline" size="sm" disabled={!unreadTotal || markAll.isPending} loading={markAll.isPending} onClick={() => markAll.mutate()}>Mark all as read</Button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />) :
          !data.notifications.length ? <EmptyState icon={Bell} title={unread ? 'No unread notifications' : 'No notifications yet'} description="You will be told here when someone messages you, answers a viewing request, or when something changes on your listings." /> :
            data.notifications.map((n) => {
              const Icon = iconFor(n.type);
              const body = (
                <>
                  <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', n.read ? 'bg-stone-100 text-stone-500' : 'bg-sage-100 text-sage-700')}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className={cn('block', n.read ? 'font-medium' : 'font-semibold')}>{!n.read && <span className="sr-only">Unread: </span>}{n.title}</span><span className="shrink-0 text-xs text-stone-500">{timeAgo(n.createdAt)}</span></span>
                    {n.body && <span className="mt-0.5 block text-sm text-stone-600">{n.body}</span>}</span>
                  {!n.read && <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />}
                </>
              );
              const cls = cn('flex gap-3 rounded-card p-4 shadow-card transition-shadow hover:shadow-lg', n.read ? 'bg-white' : 'bg-white ring-1 ring-amber-300');
              return n.link
                ? <Link key={n.id} to={n.link} className={cls} onClick={() => !n.read && markRead.mutate(n.id)}>{body}</Link>
                : <button key={n.id} type="button" className={cn(cls, 'w-full text-left')} onClick={() => !n.read && markRead.mutate(n.id)}>{body}</button>;
            })}
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />
    </div>
  );
}
