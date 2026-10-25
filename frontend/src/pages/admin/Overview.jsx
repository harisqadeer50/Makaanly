import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/admin';
import { BarList, LineChart, Panel, StackedBars } from '../../components/admin/Charts';
import Skeleton from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import { usePageTitle } from '../../hooks/usePageTitle';
import { cn } from '../../utils/cn';

function Stat({ label, value, to, hint, alert = false }) {
  const Tag = to ? Link : 'div'; // figures without a page of their own are not links (admins do not read people's private messages)
  return (
    <Tag {...(to ? { to } : {})} className={cn('rounded-card bg-white p-5 shadow-card', to && 'transition-shadow hover:shadow-lg', alert && value > 0 && 'ring-2 ring-amber-300')}>
      <p className="text-sm text-stone-500">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>{hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </Tag>
  );
}

export default function Overview() {
  usePageTitle('Admin overview');
  const { data: s, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.dashboard, staleTime: 30000 });
  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;
  if (isLoading) return <div className="space-y-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-52" /></div>;
  return (
    <div>
      <h1 className="text-3xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-stone-500">Live figures from the database.</p>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={s.users.total} to="/admin/users" hint={`${s.users.suspended} suspended`} />
        <Stat label="Active listings" value={s.listings.published} to="/admin/properties?status=published" />
        <Stat label="Waiting for review" value={s.listings.pending} to="/admin/moderation" alert />
        <Stat label="Rejected listings" value={s.listings.rejected} to="/admin/properties?status=rejected" />
        <Stat label="New inquiries" value={s.inquiries.new} hint={`${s.inquiries.last7Days} in the last 7 days`} />
        <Stat label="Reports to review" value={s.reports.open} to="/admin/reports" hint={`${s.reports.underReview} under review`} alert />
        <Stat label="Verification requests" value={s.verifications.pending} to="/admin/verifications" alert />
        <Stat label="All listings" value={s.listings.total} to="/admin/properties" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Published listings by city"><BarList items={s.listingsByCity} label="Published listings by city" emptyText="No published listings yet." /></Panel>
        <Panel title="New registrations"><LineChart data={s.registrations} label="New registrations" /></Panel>
        <Panel title="Inquiries sent"><LineChart data={s.inquiriesPerDay} label="Inquiries sent" /></Panel>
        <Panel title="Moderation activity"><StackedBars data={s.moderation} label="Moderation activity" series={[{ key: 'approved', label: 'Approved', color: '#3b674f' }, { key: 'rejected', label: 'Rejected', color: '#b45309' }]} /></Panel>
      </div>
    </div>
  );
}
