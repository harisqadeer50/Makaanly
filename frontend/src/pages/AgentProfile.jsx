import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { BadgeCheck, Building2, Mail, MapPin, Phone } from 'lucide-react';
import { agentsApi } from '../services/marketplace';
import { propertiesApi } from '../services/properties';
import Avatar from '../components/common/Avatar';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Pagination from '../components/common/Pagination';
import PropertyGrid from '../components/property/PropertyGrid';
import { useSeo } from '../hooks/useSeo';
import { agentSeo } from '../utils/seo';
import { PROPERTY_TYPES, labelOf } from '../utils/propertyOptions';

export default function AgentProfile() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const agent = useQuery({ queryKey: ['agent', id], queryFn: () => agentsApi.get(id), retry: false });
  const listings = useQuery({ queryKey: ['agent', id, 'listings', page], queryFn: () => propertiesApi.list({ lister: id, page, limit: 6 }), enabled: !!agent.data, placeholderData: keepPreviousData });
  useSeo(agent.data ? agentSeo(agent.data.agent) : { title: 'Agent', noindex: true });

  if (agent.isLoading) return <div className="container-page py-10"><Skeleton className="h-40 w-full" /></div>;
  if (agent.isError) {
    return (
      <div className="container-page py-16">
        {agent.error.status === 404
          ? <EmptyState title="Agent not found" description="This profile may have been removed." action={<Button as={Link} to="/agents">Browse agents</Button>} />
          : <ErrorState message={agent.error.message} onRetry={agent.refetch} />}
      </div>
    );
  }
  const a = agent.data.agent;
  return (
    <div className="container-page py-10">
      <section className="flex flex-wrap gap-6 rounded-card bg-white p-6 shadow-card sm:p-8" aria-label="Agent profile">
        <Avatar name={a.name} url={a.avatarUrl} size="h-24 w-24 text-3xl" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">{a.name}{a.isVerified && <Badge tone="green"><BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />Verified</Badge>}</h1>
          {a.agencyName && <p className="mt-1 flex items-center gap-1.5 text-stone-600"><Building2 className="h-4 w-4" aria-hidden="true" />{a.agencyName}</p>}
          <p className="mt-1 text-sm text-stone-500">{a.listingCount} active listing{a.listingCount === 1 ? '' : 's'}{a.memberSince && ` · On Makaanly since ${a.memberSince}`}</p>
          {a.bio && <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-stone-700">{a.bio}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {a.specialties.map((s) => <Badge key={s} tone="green">{labelOf(PROPERTY_TYPES, s)}</Badge>)}
            {a.serviceAreas.map((s) => <Badge key={s}><MapPin className="h-3 w-3" aria-hidden="true" />{s}</Badge>)}
          </div>
          {(a.contactPhone || a.contactEmail) && (
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {a.contactPhone && <li className="flex items-center gap-1.5"><Phone className="h-4 w-4" aria-hidden="true" /><a href={`tel:${a.contactPhone}`} className="hover:underline">{a.contactPhone}</a></li>}
              {a.contactEmail && <li className="flex items-center gap-1.5"><Mail className="h-4 w-4" aria-hidden="true" /><a href={`mailto:${a.contactEmail}`} className="hover:underline">{a.contactEmail}</a></li>}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="listings-h">
        <h2 id="listings-h" className="mb-5 text-2xl font-semibold">Listings by {a.name.split(' ')[0]}</h2>
        <PropertyGrid items={listings.data?.properties} isLoading={listings.isLoading} isError={listings.isError} error={listings.error} onRetry={listings.refetch} count={3}
          empty={<EmptyState title="No active listings" description="This agent has no published properties right now." />} />
        <Pagination page={page} totalPages={listings.data?.meta?.totalPages ?? 1} onChange={setPage} />
      </section>
    </div>
  );
}
