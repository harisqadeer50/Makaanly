import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../services/marketplace';

// The unread count refreshes every minute while the tab is open, and when you come back to it.
export function useUnreadCount() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'unread'], queryFn: notificationsApi.unreadCount, enabled: isAuthenticated,
    refetchInterval: 60000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, staleTime: 20000, select: (d) => d.count,
  });
}
