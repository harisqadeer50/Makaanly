import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '../../hooks/useNotifications';

export default function NotificationBell({ className = '' }) {
  const { data: count = 0 } = useUnreadCount();
  return (
    <Link to="/dashboard/notifications" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'} className={`relative grid h-10 w-10 place-items-center rounded-lg hover:bg-stone-100 ${className}`}>
      <Bell className="h-5 w-5" aria-hidden="true" />
      {count > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-amber-400 px-1 text-[0.65rem] font-bold leading-[1.1rem] text-navy-900">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
