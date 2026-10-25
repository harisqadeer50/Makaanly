import PropertyCard from './PropertyCard';
import { PropertyCardSkeleton } from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';

export default function PropertyGrid({ items, isLoading, isError, error, onRetry, empty, count = 6, layout = 'grid', heading }) {
  const cols = layout === 'list' ? 'grid gap-5' : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';
  if (isError) return <ErrorState message={error?.message || 'We could not load properties.'} onRetry={onRetry} />;
  if (isLoading) return <div className={cols}>{Array.from({ length: count }, (_, i) => <PropertyCardSkeleton key={i} />)}</div>;
  if (!items?.length) return empty || <EmptyState title="No properties found" description="Check back soon, new listings are added regularly." />;
  return <div className={cols}>{items.map((p) => <PropertyCard key={p.id} property={p} layout={layout} heading={heading} />)}</div>;
}
