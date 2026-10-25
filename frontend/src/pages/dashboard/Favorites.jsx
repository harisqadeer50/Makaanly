import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { favoritesApi } from '../../services/marketplace';
import PropertyGrid from '../../components/property/PropertyGrid';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function Favorites() {
  usePageTitle('Saved properties');
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['favorites', 'list'], queryFn: favoritesApi.list });
  return (
    <div>
      <h1 className="text-3xl font-bold">Saved properties</h1>
      <p className="mt-1 text-sm text-stone-500">Listings that are no longer available are hidden until they come back.</p>
      <div className="mt-6">
        <PropertyGrid heading="h2" items={data?.properties} isLoading={isLoading} isError={isError} error={error} onRetry={refetch}
          empty={<EmptyState icon={Heart} title="You have not saved any properties yet" description="Tap the heart on a listing to keep it here." action={<Button as={Link} to="/properties" variant="accent">Browse properties</Button>} />} />
      </div>
    </div>
  );
}
