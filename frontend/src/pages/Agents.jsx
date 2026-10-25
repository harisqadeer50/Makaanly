import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { BadgeCheck, Building2, UserRound } from 'lucide-react';
import { agentsApi } from '../services/marketplace';
import Avatar from '../components/common/Avatar';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { Select } from '../components/common/FormFields';
import Pagination from '../components/common/Pagination';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Skeleton from '../components/common/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { CITIES } from '../utils/locations';
import { PROPERTY_TYPES, labelOf } from '../utils/propertyOptions';

export function AgentCard({ agent: a }) {
  return (
    <li>
      <Link to={`/agents/${a.id}`} className="flex h-full gap-4 rounded-card bg-white p-5 shadow-card transition-shadow hover:shadow-lg">
        <Avatar name={a.name} url={a.avatarUrl} size="h-16 w-16 text-xl" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold">{a.name}{a.isVerified && <BadgeCheck className="h-4 w-4 text-sage-600" aria-label="Verified" />}</p>
          {a.agencyName && <p className="flex items-center gap-1 text-sm text-stone-500"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{a.agencyName}</p>}
          {a.serviceAreas.length > 0 && <p className="mt-1 truncate text-sm text-stone-700">{a.serviceAreas.slice(0, 3).join(' · ')}</p>}
          <p className="mt-1 text-xs text-stone-500">{a.listingCount} active listing{a.listingCount === 1 ? '' : 's'}{a.specialties.length > 0 && ` · ${a.specialties.slice(0, 2).map((s) => labelOf(PROPERTY_TYPES, s)).join(', ')}`}</p>
        </div>
      </Link>
    </li>
  );
}

export default function Agents() {
  usePageTitle('Real estate agents');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || ''; const city = params.get('city') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = { page, limit: 12, ...(q && { q }), ...(city && { city }) };
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['agents', query], queryFn: () => agentsApi.list(query), placeholderData: keepPreviousData });
  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Real estate agents</h1>
      <form role="search" className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); update({ q: new FormData(e.target).get('q').trim(), page: '' }); }}>
        <Input label="Agent name" name="q" defaultValue={q} key={q} placeholder="Search by name" className="w-64" />
        <Select label="Area" value={city} onChange={(e) => update({ city: e.target.value, page: '' })} placeholder="All areas" options={CITIES.map((c) => ({ value: c.name, label: c.name }))} className="w-48" />
        <Button type="submit">Search</Button>
      </form>
      <div className="mt-8">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : !data.agents.length ? (
          <EmptyState icon={UserRound} title="No agents found" description={q || city ? 'Try a different name or area.' : 'Agents appear here once they complete their public profile.'} />
        ) : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.agents.map((a) => <AgentCard key={a.id} agent={a} />)}</ul>}
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />
    </div>
  );
}
