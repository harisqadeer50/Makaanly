import { useState } from 'react';
import { Heart } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { PropertyCardSkeleton } from '../components/common/Skeleton';

const Section = ({ title, children }) => (
  <section className="mt-10"><h2 className="mb-4 text-xl font-semibold">{title}</h2>{children}</section>
);

export default function DesignSystem() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Design system</h1>
      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button><Button variant="accent">Accent</Button><Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button><Button variant="danger">Delete</Button><Button disabled>Disabled</Button>
          <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>Save changes</Button>
          <Button variant="outline" aria-label="Save to favorites" className="w-11 px-0"><Heart className="h-5 w-5" /></Button>
        </div>
      </Section>
      <Section title="Form fields">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Input label="City" placeholder="Lahore" />
          <Input label="Email" type="email" error="Enter a valid email address" defaultValue="haris@" />
          <Input label="Max price (PKR)" hint="Numbers only" inputMode="numeric" />
        </div>
      </Section>
      <Section title="Badges">
        <div className="flex flex-wrap gap-2"><Badge>For sale</Badge><Badge tone="navy">Featured</Badge><Badge tone="green">Verified</Badge><Badge tone="amber">Pending review</Badge><Badge tone="red">Rejected</Badge></div>
      </Section>
      <Section title="Loading, empty and error states">
        <div className="grid gap-5 md:grid-cols-3"><PropertyCardSkeleton /><PropertyCardSkeleton /><PropertyCardSkeleton /></div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <EmptyState title="No properties match your filters" description="Try widening your price range or choosing a nearby area." action={<Button variant="outline">Clear filters</Button>} />
          <ErrorState message="We couldn't load properties. Check your connection and try again." onRetry={() => {}} />
        </div>
      </Section>
    </div>
  );
}
