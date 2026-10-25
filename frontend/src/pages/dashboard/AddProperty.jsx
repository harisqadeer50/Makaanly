import PropertyForm from '../../components/property/PropertyForm';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function AddProperty({ basePath = '/dashboard/properties', admin = false }) {
  usePageTitle('Add property');
  return <PropertyForm basePath={basePath} admin={admin} />;
}
