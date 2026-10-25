import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Building2, PlusCircle, Heart, MessageSquare, CalendarDays, UserRound, BadgeCheck, ShieldCheck, Bell, Settings as SettingsIcon } from 'lucide-react';
import { useUnreadCount } from '../../hooks/useNotifications';
import { dashboardApi } from '../../services/marketplace';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

const MANAGER = ['owner', 'agent', 'admin'];
const items = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/properties', label: 'My properties', icon: Building2, end: true, roles: MANAGER },
  { to: '/dashboard/properties/new', label: 'Add property', icon: PlusCircle, roles: MANAGER },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: 'unread' },
  { to: '/dashboard/favorites', label: 'Saved', icon: Heart },
  { to: '/dashboard/inquiries', label: 'Inquiries', icon: MessageSquare, badge: 'newInquiries' },
  { to: '/dashboard/appointments', label: 'Viewings', icon: CalendarDays, badge: 'pendingViewings' },
  { to: '/dashboard/verification', label: 'Verification', icon: BadgeCheck, roles: ['owner', 'agent'] },
  { to: '/dashboard/profile', label: 'Profile', icon: UserRound },
  { to: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/admin', label: 'Admin panel', icon: ShieldCheck, roles: ['admin'] },
];

export default function DashboardLayout() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary, staleTime: 30000 });
  const unread = useUnreadCount().data ?? 0;
  const counts = { newInquiries: data?.newInquiries ?? 0, pendingViewings: data?.pendingViewings ?? 0, unread };
  const nav = items.filter((i) => !i.roles || i.roles.includes(user.role));
  const link = ({ isActive }) => cn('flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-navy-900 text-white' : 'text-navy-800 hover:bg-stone-100');
  return (
    <div className="container-page py-6 lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8 lg:py-10">
      {/* Sidebar on desktop, scrollable tab strip on small screens */}
      <nav aria-label="Dashboard" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:mb-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
        {nav.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className={link}>
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
            {badge && counts[badge] > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-navy-900"><span className="sr-only">{counts[badge]} new: </span><span aria-hidden="true">{counts[badge]}</span></span>}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0"><Outlet /></div>
    </div>
  );
}
