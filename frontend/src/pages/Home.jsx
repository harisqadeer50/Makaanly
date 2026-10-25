import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Briefcase, Building2, Home as HomeIcon, MapPin, ShoppingBag, Store, Trees } from 'lucide-react';
import { propertiesApi } from '../services/properties';
import { getHealth } from '../services/health';
import PropertyGrid from '../components/property/PropertyGrid';
import HeroSearch from '../components/property/HeroSearch';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { CITIES } from '../utils/locations';
import { useActiveTypes } from '../hooks/useCategories';
import { useSeo } from '../hooks/useSeo';
import { websiteJsonLd } from '../utils/seo';
import { HowItWorks, FeaturedAgents, WhyChoose, Testimonials, Faq, ListCta } from '../components/home/HomeSections';

const TYPE_CARDS = [
  { type: 'house', label: 'Houses', icon: HomeIcon },
  { type: 'apartment', label: 'Apartments & flats', icon: Building2 },
  { type: 'plot', label: 'Plots & land', icon: Trees },
  { type: 'commercial', label: 'Commercial', icon: Store },
  { type: 'office', label: 'Offices', icon: Briefcase },
  { type: 'shop', label: 'Shops', icon: ShoppingBag },
];

function DevStatus() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: 1 });
  return (
    <div className="container-page pb-6 text-xs" role="status">
      <span className="mr-2 text-stone-500">Dev status:</span>
      {isLoading && <Badge>Checking…</Badge>}
      {isError && <Badge tone="red">API unreachable</Badge>}
      {data && (<><Badge tone="green">API {data.status}</Badge> <Badge tone={data.db === 'connected' ? 'green' : 'amber'}>Database {data.db}</Badge></>)}
    </div>
  );
}

function Section({ id, title, action, children }) {
  return (
    <section className="container-page py-10" aria-labelledby={id}>
      <div className="mb-6 flex items-end justify-between gap-4"><h2 id={id} className="text-2xl font-semibold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export default function Home() {
  useSeo({ jsonLd: websiteJsonLd() });
  const activeTypes = useActiveTypes().map((t) => t.value);
  const featured = useQuery({ queryKey: ['properties', 'featured'], queryFn: () => propertiesApi.list({ featured: true, limit: 6 }) });
  const recent = useQuery({ queryKey: ['properties', 'recent'], queryFn: () => propertiesApi.list({ limit: 6 }) });
  const locations = useQuery({ queryKey: ['locations', ''], queryFn: () => propertiesApi.locations(), staleTime: 120000 });
  const cities = (locations.data?.cities || CITIES.map((c) => ({ name: c.name, count: 0 }))).slice(0, 5);

  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="container-page py-16 sm:py-24">
          <h1 className="max-w-3xl text-4xl font-bold sm:text-6xl">Find a place you'll love to call home.</h1>
          <p className="mt-5 max-w-xl text-lg text-navy-100">Explore houses, apartments, plots and commercial properties. Discover your next home with Makaanly.</p>
          <div className="mt-8 max-w-5xl"><HeroSearch /></div>
        </div>
      </section>

      {featured.data?.properties?.length > 0 && (
        <Section id="featured-heading" title="Featured properties" action={<Link to="/properties" className="text-sm font-medium text-sage-600 hover:underline">View all</Link>}>
          <PropertyGrid items={featured.data.properties} count={3} />
        </Section>
      )}

      <Section id="types-heading" title="Browse by property type">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TYPE_CARDS.filter((c) => activeTypes.includes(c.type)).sort((a, b) => activeTypes.indexOf(a.type) - activeTypes.indexOf(b.type)).map(({ type, label, icon: Icon }) => (
            <li key={label}>
              <Link to={`/properties?type=${type}`} className="flex h-full flex-col items-center gap-2 rounded-card bg-white p-5 text-center text-sm font-medium shadow-card transition-shadow hover:shadow-lg">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-sage-100 text-sage-600"><Icon className="h-5 w-5" aria-hidden="true" /></span>{label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="places-heading" title="Popular locations">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cities.map((c) => (
            <li key={c.name}>
              <Link to={`/properties?city=${encodeURIComponent(c.name)}`} className="flex items-center gap-3 rounded-card bg-white p-4 shadow-card transition-shadow hover:shadow-lg">
                <MapPin className="h-5 w-5 shrink-0 text-sage-600" aria-hidden="true" />
                <span><span className="block font-semibold">{c.name}</span><span className="text-xs text-stone-500">{c.count ? `${c.count} propert${c.count === 1 ? 'y' : 'ies'}` : 'Explore'}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="recent-heading" title="Recently listed" action={<Link to="/properties" className="text-sm font-medium text-sage-600 hover:underline">View all</Link>}>
        <PropertyGrid items={recent.data?.properties} isLoading={recent.isLoading} isError={recent.isError} error={recent.error} onRetry={recent.refetch}
          empty={<EmptyState title="No listings yet" description="Be the first to list a property on Makaanly." action={<Button as={Link} to="/dashboard/properties/new" variant="accent">List your property</Button>} />} />
      </Section>
      <HowItWorks />
      <FeaturedAgents />
      <WhyChoose />
      <Testimonials />
      <Faq />
      <ListCta />
      {import.meta.env.DEV && <DevStatus />}
    </>
  );
}
