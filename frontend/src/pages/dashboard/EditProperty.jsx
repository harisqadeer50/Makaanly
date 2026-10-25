import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../../services/properties';
import PropertyForm from '../../components/property/PropertyForm';
import Skeleton from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function EditProperty({ basePath = '/dashboard/properties', admin = false }) {
  const { id } = useParams();
  usePageTitle('Edit property');
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['property', 'managed', id], queryFn: () => propertiesApi.getManaged(id), retry: false, gcTime: 0,
  });
  if (isLoading) return <div className="max-w-3xl space-y-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-96 w-full" /></div>;
  if (isError) {
    return error.status === 404
      ? <EmptyState title="Listing not found" description="It may have been deleted, or it belongs to another account." action={<Button as={Link} to={basePath}>Back to the list</Button>} />
      : <ErrorState message={error.message} onRetry={refetch} />;
  }
  return <PropertyForm key={data.property.id} property={data.property} basePath={basePath} admin={admin} />;
}
