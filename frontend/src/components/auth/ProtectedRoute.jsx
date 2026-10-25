import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import { ShieldAlert } from 'lucide-react';

// UI guard only. The API enforces the same rules on every request.
export function ProtectedRoute({ roles }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="container-page py-16" role="status" aria-label="Loading"><Skeleton className="h-8 w-48" /><Skeleton className="mt-4 h-40 w-full" /></div>;
  }
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) {
    return <div className="container-page py-16"><EmptyState icon={ShieldAlert} title="You don't have access to this page" description="Your account type can't use this area." /></div>;
  }
  return <Outlet />;
}

// Keeps signed-in users away from login/register.
export function GuestRoute() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
