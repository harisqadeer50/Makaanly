import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Building2, ShieldCheck, Users, Flag, BadgeCheck, Tags, ScrollText, ClipboardCheck, ArrowLeft } from 'lucide-react';
import { adminApi } from '../../services/admin';
import { cn } from '../../utils/cn';

const items = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/moderation', label: 'Moderation', icon: ClipboardCheck, badge: (s) => s.listings.pending },
  { to: '/admin/properties', label: 'Listings', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: Flag, badge: (s) => s.reports.open },
  { to: '/admin/verifications', label: 'Verifications', icon: BadgeCheck, badge: (s) => s.verifications.pending },
  { to: '/admin/categories', label: 'Property types', icon: Tags },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
];

export default function AdminLayout() {
  const { data } = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.dashboard, staleTime: 30000 });
  const link = ({ isActive }) => cn('flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-navy-900 text-white' : 'text-navy-800 hover:bg-stone-100');
  return (
    <div className="container-page py-6 lg:grid lg:grid-cols-[14.5rem_1fr] lg:gap-8 lg:py-10">
      <nav aria-label="Administration" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:mb-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
        <p className="hidden items-center gap-2 px-3.5 pb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 lg:flex"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Administration</p>
        {items.map(({ to, label, icon: Icon, end, badge }) => {
          const count = data && badge ? badge(data) : 0;
          return (
            <NavLink key={to} to={to} end={end} className={link}>
              <Icon className="h-4 w-4" aria-hidden="true" />{label}
              {count > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-navy-900"><span className="sr-only">{count} waiting: </span><span aria-hidden="true">{count}</span></span>}
            </NavLink>
          );
        })}
        <NavLink to="/dashboard" className="flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm text-stone-500 hover:text-navy-900 lg:mt-3"><ArrowLeft className="h-4 w-4" aria-hidden="true" />My dashboard</NavLink>
      </nav>
      <div className="min-w-0"><Outlet /></div>
    </div>
  );
}
