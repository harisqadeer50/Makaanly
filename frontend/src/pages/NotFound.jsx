import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import { useSeo } from '../hooks/useSeo';

export default function NotFound() {
  useSeo({ title: 'Page not found', noindex: true });
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-5xl font-bold">Page not found</h1>
      <p className="mt-3 text-stone-500">The page you're looking for doesn't exist or has moved.</p>
      <Button as={Link} to="/" className="mt-6">Back to home</Button>
    </div>
  );
}
