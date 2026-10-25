import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import { authApi } from '../services/auth';
import { dashboardApi } from '../services/marketplace';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';

const ROLE_LABEL = { buyer: 'Buyer / tenant', owner: 'Property owner', agent: 'Agent', admin: 'Administrator' };

function Stat({ label, value, to }) {
  return (
    <Link to={to} className="rounded-card bg-white p-5 shadow-card transition-shadow hover:shadow-lg">
      <p className="text-sm text-stone-500">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const isManager = ['owner', 'agent', 'admin'].includes(user.role);
  const summary = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary });

  const resend = async () => {
    setSending(true);
    try { await authApi.resendVerification(); toast.success('Verification email sent. Check your inbox.'); }
    catch (err) { toast.error(err.message); } finally { setSending(false); }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Hello, {user.name.split(' ')[0]}</h1>
      <div className="mt-2 flex items-center gap-2"><Badge tone="navy">{ROLE_LABEL[user.role]}</Badge>{user.isEmailVerified && <Badge tone="green">Email verified</Badge>}</div>

      {!user.isEmailVerified && (
        <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <MailWarning className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Verify your email to list properties and send inquiries.</span>
          <Button size="sm" variant="outline" loading={sending} onClick={resend}>Resend email</Button>
        </div>
      )}

      <section className="mt-8" aria-label="Overview">
        {summary.isError ? <ErrorState message={summary.error.message} onRetry={summary.refetch} /> : summary.isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isManager && <Stat label="Total listings" value={summary.data.listings.total} to="/dashboard/properties" />}
            {isManager && <Stat label="Published" value={summary.data.listings.published} to="/dashboard/properties?status=published" />}
            {isManager && <Stat label="Pending review" value={summary.data.listings.pending} to="/dashboard/properties?status=pending_review" />}
            {isManager && <Stat label="Drafts" value={summary.data.listings.drafts} to="/dashboard/properties?status=draft" />}
            {isManager && <Stat label="New inquiries" value={summary.data.newInquiries} to="/dashboard/inquiries" />}
            {isManager && <Stat label="Viewing requests to answer" value={summary.data.pendingViewings} to="/dashboard/appointments" />}
            <Stat label="Upcoming viewings" value={summary.data.upcomingViewings} to={isManager ? '/dashboard/appointments?tab=mine' : '/dashboard/appointments'} />
            <Stat label="Saved properties" value={summary.data.favorites} to="/dashboard/favorites" />
          </div>
        )}
        {isManager && <Button as={Link} to="/dashboard/properties/new" variant="accent" className="mt-6">Add a property</Button>}
      </section>
    </div>
  );
}
