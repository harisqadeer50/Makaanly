import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { LayoutGrid, List, Map as MapIcon, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { propertiesApi } from '../services/properties';
import PropertyGrid from '../components/property/PropertyGrid';
import PropertyFilters from '../components/property/PropertyFilters';
import Pagination from '../components/common/Pagination';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import Modal from '../components/common/Modal';
import { Select } from '../components/common/FormFields';
import { useSeo } from '../hooks/useSeo';
import { searchSeo, searchTitle } from '../utils/seo';
import { DEFAULT_FILTERS, parseFilters, parsePage, parseView, toApiQuery, toSearchParams, activeChips } from '../utils/searchParams';
import { cn } from '../utils/cn';

const SearchMap = lazy(() => import('../components/property/SearchMap'));
const PAGE_SIZE = 12;
const MAP_PAGE_SIZE = 48;
const VIEW_BUTTONS = [['grid', 'Grid', LayoutGrid], ['list', 'List', List], ['map', 'Map', MapIcon]];

export default function Properties() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const page = parsePage(params);
  const view = parseView(params);
  const chips = activeChips(filters);
  const seo = searchSeo(filters, page);
  useSeo({ title: searchTitle(filters), description: `Browse ${searchTitle(filters).toLowerCase()} on Makaanly. Filter by price, area in marla or kanal, bedrooms and more.`, canonical: seo.canonical, noindex: seo.noindex });

  const [text, setText] = useState(filters.q);
  const [sheet, setSheet] = useState(false);
  useEffect(() => setText(filters.q), [filters.q]);

  const apiQuery = useMemo(() => toApiQuery(filters, { page, limit: view === 'map' ? MAP_PAGE_SIZE : PAGE_SIZE }), [filters, page, view]);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['properties', 'search', apiQuery], queryFn: () => propertiesApi.list(apiQuery), placeholderData: keepPreviousData,
  });

  const go = (nextFilters, nextPage = 1, nextView = view) => setParams(toSearchParams(nextFilters, { page: nextPage, view: nextView }));
  const clearAll = () => go({ ...DEFAULT_FILTERS, sort: filters.sort });
  const total = data?.meta?.total;
  const sortOptions = [
    { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
    { value: 'price_asc', label: 'Price: low to high' }, { value: 'price_desc', label: 'Price: high to low' },
  ];
  if (filters.q) sortOptions.unshift({ value: 'relevance', label: 'Best match' });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold">Properties</h1>

      <form role="search" className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); go({ ...filters, q: text.trim() }); }}>
        <div className="relative min-w-[14rem] flex-1">
          <label htmlFor="q" className="sr-only">Search properties</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <input id="q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by area, project or keyword"
            className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm focus:border-sage-500" />
        </div>
        <Button type="submit">Search</Button>
        <Select aria-label="Sort by" value={filters.sort || (filters.q ? 'relevance' : 'newest')} onChange={(e) => go({ ...filters, sort: e.target.value })} options={sortOptions} className="w-48" />
        <div className="flex overflow-hidden rounded-lg border border-stone-300 bg-white" role="group" aria-label="Result view">
          {VIEW_BUTTONS.map(([v, label, Icon]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => go(filters, 1, v)}
              className={cn('flex h-11 items-center gap-1.5 px-3 text-sm font-medium', view === v ? 'bg-navy-900 text-white' : 'hover:bg-stone-100')}><Icon className="h-4 w-4" aria-hidden="true" />{label}</button>
          ))}
        </div>
        <Button type="button" variant="outline" className="lg:hidden" onClick={() => setSheet(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Filters{chips.length ? ` (${chips.length})` : ''}
        </Button>
      </form>

      {chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => go(c.clear(filters))} aria-label={`Remove filter: ${c.label}`}
                className="flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1.5 text-sm font-medium text-sage-700 hover:bg-sage-200">{c.label}<X className="h-3.5 w-3.5" aria-hidden="true" /></button>
            </li>
          ))}
          <li><button type="button" onClick={clearAll} className="px-2 text-sm font-medium text-navy-800 underline">Clear all</button></li>
        </ul>
      )}

      <div className="mt-6 lg:grid lg:grid-cols-[18rem_1fr] lg:gap-8">
        <aside className="hidden lg:block"><div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-card bg-white p-5 shadow-card"><PropertyFilters value={filters} onChange={(f) => go(f)} /></div></aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <h2 id="results-heading" className="sr-only">Search results</h2>
          <p className="mb-4 text-sm text-stone-500" aria-live="polite">{total === undefined ? '\u00a0' : `${total.toLocaleString()} propert${total === 1 ? 'y' : 'ies'} found`}</p>

          {view === 'map' && data?.properties?.length > 0 && (
            <div className="mb-6"><Suspense fallback={<Skeleton className="h-[28rem] w-full" />}><SearchMap properties={data.properties} /></Suspense></div>
          )}

          <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
            <PropertyGrid items={data?.properties} isLoading={isLoading} isError={isError} error={error} onRetry={refetch} layout={view === 'list' ? 'list' : 'grid'} count={6}
              empty={<EmptyState icon={SearchX} title="No properties match your search" description={chips.length ? 'Try removing a filter or widening your price range.' : 'No listings are published yet. Check back soon.'}
                action={chips.length ? <Button variant="outline" onClick={clearAll}>Clear all filters</Button> : undefined} />} />
          </div>
          <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => { go(filters, p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </section>
      </div>

      <Modal open={sheet} onClose={() => setSheet(false)} title="Filters" sheet>
        <PropertyFilters mode="manual" headingLevel="h3" label="Refine your search" value={filters} onChange={(f) => go(f)} onDone={() => setSheet(false)} />
      </Modal>
    </div>
  );
}
