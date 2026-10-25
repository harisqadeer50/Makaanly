import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Users as UsersIcon } from 'lucide-react';
import { adminApi } from '../../services/admin';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/admin/DataTable';
import ReasonDialog from '../../components/admin/ReasonDialog';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { Select } from '../../components/common/FormFields';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { formatDate } from '../../utils/format';

const ROLES = [{ value: 'buyer', label: 'Buyers' }, { value: 'owner', label: 'Owners' }, { value: 'agent', label: 'Agents' }, { value: 'admin', label: 'Administrators' }];
const ROLE_LABEL = { buyer: 'Buyer', owner: 'Owner', agent: 'Agent', admin: 'Admin' };

export default function Users() {
  usePageTitle('Users');
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') || ''; const role = params.get('role') || ''; const status = params.get('status') || '';
  const query = { page, limit: 20, ...(q && { q }), ...(role && { role }), ...(status && { status }) };
  const toast = useToast(); const qc = useQueryClient();
  const [suspending, setSuspending] = useState(null); const [reactivating, setReactivating] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'users', query], queryFn: () => adminApi.users(query), placeholderData: keepPreviousData });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['properties'] }); setSuspending(null); setReactivating(null); };
  const change = useMutation({
    mutationFn: ({ u, isActive, reason }) => adminApi.setUserStatus(u.id, { isActive, ...(reason && { reason }) }),
    onSuccess: (r) => { const u = r.user; toast.success(u.isActive ? `${u.name} can sign in again.${u.restoredListings ? ` ${u.restoredListings} listing(s) were restored.` : ''}` : `${u.name} was suspended.${u.pausedListings ? ` ${u.pausedListings} live listing(s) were paused.` : ''}`); refresh(); },
    onError: (e) => { toast.error(errorMessage(e)); refresh(); },
  });
  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };

  const columns = [
    { key: 'user', header: 'Person', render: (u) => (
      <div className="flex min-w-[13rem] items-center gap-3"><Avatar name={u.name} size="h-9 w-9 text-sm" /><div className="min-w-0"><p className="font-medium">{u.name}</p><p className="truncate text-xs text-stone-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p></div></div>) },
    { key: 'role', header: 'Role', render: (u) => <div className="flex flex-wrap gap-1"><Badge tone={u.role === 'admin' ? 'navy' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge>{u.verificationStatus === 'verified' && <Badge tone="green">Verified</Badge>}{!u.isEmailVerified && <Badge tone="amber">Email unverified</Badge>}</div> },
    { key: 'listings', header: 'Listings', className: 'tabular-nums', render: (u) => u.listingCount },
    { key: 'joined', header: 'Joined', render: (u) => <span className="whitespace-nowrap text-stone-500">{formatDate(u.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (u) => (u.isActive ? <Badge tone="green">Active</Badge> : <div><Badge tone="red">Suspended</Badge>{u.suspensionReason && <p className="mt-1 max-w-[14rem] text-xs text-stone-500">{u.suspensionReason}</p>}</div>) },
    { key: 'actions', header: 'Actions', render: (u) => {
      if (u.role === 'admin' || u.id === me.id) return <span className="text-xs text-stone-500">{u.id === me.id ? 'This is you' : 'Protected'}</span>;
      return u.isActive
        ? <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => setSuspending(u)}>Suspend…</Button>
        : <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => setReactivating(u)}>Reactivate</Button>;
    } },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold">Users</h1>
      <form role="search" className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); update({ q: new FormData(e.target).get('q').trim(), page: '' }); }}>
        <div className="relative min-w-[14rem] flex-1"><label htmlFor="usr-q" className="sr-only">Search users</label><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <input id="usr-q" name="q" defaultValue={q} key={q} type="search" placeholder="Name or email" className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm focus:border-sage-500" /></div>
        <Select aria-label="Role" value={role} onChange={(e) => update({ role: e.target.value, page: '' })} placeholder="All roles" className="w-44" options={ROLES} />
        <Select aria-label="Status" value={status} onChange={(e) => update({ status: e.target.value, page: '' })} placeholder="Any status" className="w-40" options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
        <Button type="submit">Search</Button>
      </form>
      <div className="mt-5"><DataTable caption="Users" columns={columns} rows={data?.users} isLoading={isLoading} isError={isError} error={error} onRetry={refetch} empty={<EmptyState icon={UsersIcon} title="No users match" description="Try a different search or filter." />} /></div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />

      <ReasonDialog open={!!suspending} onClose={() => setSuspending(null)} loading={change.isPending} danger confirmLabel="Suspend account" label="Reason"
        title={`Suspend ${suspending?.name ?? ''}?`} message="They are signed out everywhere and cannot sign in. Their live listings are paused until the account is reactivated."
        onConfirm={(reason) => change.mutate({ u: suspending, isActive: false, reason })} />
      <ConfirmDialog open={!!reactivating} onClose={() => setReactivating(null)} loading={change.isPending} title={`Reactivate ${reactivating?.name ?? ''}?`} confirmLabel="Reactivate"
        message="They can sign in again. Listings that were paused by the suspension go live again; listings they paused themselves stay paused." onConfirm={() => change.mutate({ u: reactivating, isActive: true })} />
    </div>
  );
}
