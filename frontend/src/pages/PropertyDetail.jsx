import { lazy, Suspense, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Share2, Pencil, BadgeCheck, Info, SearchX, CalendarPlus, Flag, MailWarning } from 'lucide-react';
import { propertiesApi } from '../services/properties';
import PropertyGallery from '../components/property/PropertyGallery';
import PropertyGrid from '../components/property/PropertyGrid';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { useToast } from '../components/common/Toast';
import Avatar from '../components/common/Avatar';
import FavoriteButton from '../components/marketplace/FavoriteButton';
import InquiryForm from '../components/marketplace/InquiryForm';
import ViewingModal from '../components/marketplace/ViewingModal';
import ReportModal from '../components/marketplace/ReportModal';
import { useAuth } from '../context/AuthContext';
import { formatPrice, formatArea, formatMoney, formatDate, locationLine, periodLabel } from '../utils/format';
import { useSeo } from '../hooks/useSeo';
import { propertySeo } from '../utils/seo';
import { labelOf, PROPERTY_TYPES, CONDITIONS, FURNISHING, AMENITIES, STATUS_LABELS } from '../utils/propertyOptions';

const LocationMap = lazy(() => import('../components/property/LocationMap'));

function Spec({ label, value }) {
  if (value == null || value === '') return null;
  return <div className="rounded-lg bg-stone-50 px-4 py-3"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>;
}

function Unavailable() {
  const { data } = useQuery({ queryKey: ['properties', 'recent-fallback'], queryFn: () => propertiesApi.list({ limit: 3 }) });
  return (
    <div className="container-page py-16">
      <EmptyState icon={SearchX} title="This property isn't available" description="The listing may have been removed, paused or never published. Here are some properties you might like."
        action={<Button as={Link} to="/properties">Browse all properties</Button>} />
      {data?.properties?.length > 0 && <div className="mt-10"><PropertyGrid items={data.properties} count={3} /></div>}
    </div>
  );
}

export default function PropertyDetail() {
  const { slug } = useParams();
  const toast = useToast();
  const { status: authStatus, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [viewingOpen, setViewingOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['property', slug], queryFn: () => propertiesApi.get(slug), retry: false });
  const similar = useQuery({ queryKey: ['property', slug, 'similar'], queryFn: () => propertiesApi.similar(slug), enabled: !!data, retry: false });

  useSeo(data ? propertySeo(data.property, { preview: !!data.viewer?.isPreview }) : { title: 'Property', noindex: true });

  if (isLoading) return <div className="container-page py-10"><Skeleton className="aspect-[16/9] w-full" /><Skeleton className="mt-6 h-8 w-1/2" /><Skeleton className="mt-3 h-5 w-1/3" /></div>;
  if (isError) return error.status === 404 ? <Unavailable /> : <div className="container-page py-16"><ErrorState message={error.message} onRetry={refetch} /></div>;

  const { property: p, viewer } = data;
  const unavailable = p.status === 'sold' || p.status === 'rented';
  const isPreview = viewer?.isPreview;
  const point = p.location.coordinates;
  const amenities = (p.amenities || []).map((a) => labelOf(AMENITIES, a));
  const lister = p.assignedAgent || p.owner;
  const canContact = p.status === 'published' && !isPreview && !viewer?.canEdit;
  const loginState = { state: { from: location } };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copied to clipboard.'); }
    } catch { /* the person closed the share sheet */ }
  };

  return (
    <div className="container-page py-8">
      {isPreview && (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />Preview only. This listing is <strong>{STATUS_LABELS[p.status]}</strong> and is not visible to the public.
        </div>
      )}
      {unavailable && (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-card border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-800">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />This property has been <strong>{p.status}</strong> and is no longer available. See similar properties below.
        </div>
      )}

      <PropertyGallery images={p.images} title={p.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy">{p.purpose === 'rent' ? 'For rent' : 'For sale'}</Badge>
            <Badge>{labelOf(PROPERTY_TYPES, p.propertyType)}</Badge>
            {p.isFeatured && <Badge tone="green">Featured</Badge>}
            {unavailable && <Badge tone="red">{STATUS_LABELS[p.status]}</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-bold">{p.title}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-stone-500"><MapPin className="h-4 w-4" aria-hidden="true" />{locationLine(p.location)}{p.location.area ? `, ${p.location.area}` : ''}</p>
          <p className="mt-4 text-3xl font-bold text-navy-900">{formatPrice(p)}</p>
          {p.negotiable && <p className="text-sm text-sage-600">Price is negotiable</p>}

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Spec label="Covered area" value={formatArea(p.coveredArea, p.areaUnit)} />
            <Spec label="Plot area" value={formatArea(p.plotArea, p.areaUnit)} />
            <Spec label="Bedrooms" value={p.bedrooms} /><Spec label="Bathrooms" value={p.bathrooms} />
            <Spec label="Kitchens" value={p.kitchens} /><Spec label="Floors" value={p.floors} />
            <Spec label="Parking spaces" value={p.parkingSpaces} />
            <Spec label="Condition" value={labelOf(CONDITIONS, p.condition)} />
            <Spec label="Furnishing" value={p.furnishing && labelOf(FURNISHING, p.furnishing)} />
            <Spec label="Year built" value={p.constructionYear} />
            {p.purpose === 'rent' && <Spec label="Rent period" value={periodLabel(p.rentalPeriod)} />}
            {p.purpose === 'rent' && <Spec label="Security deposit" value={p.securityDeposit != null && formatMoney(p.securityDeposit, p.currency)} />}
            <Spec label="Maintenance" value={p.maintenanceCharges != null && formatMoney(p.maintenanceCharges, p.currency)} />
          </dl>

          <section className="mt-8"><h2 className="text-xl font-semibold">About this property</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-stone-700">{p.description}</p></section>

          {amenities.length > 0 && (
            <section className="mt-8"><h2 className="text-xl font-semibold">Amenities</h2>
              <ul className="mt-3 flex flex-wrap gap-2">{amenities.map((a) => <li key={a}><Badge tone="green">{a}</Badge></li>)}</ul></section>
          )}

          <section className="mt-8">
            <h2 className="text-xl font-semibold">Location</h2>
            {p.location.street && <p className="mt-2 text-sm text-stone-700">{p.location.street}</p>}
            {point ? (
              <>
                <div className="mt-3 overflow-hidden rounded-card"><Suspense fallback={<Skeleton className="h-72 w-full" />}><LocationMap point={point} approximate={point.approximate} /></Suspense></div>
                {point.approximate && <p className="mt-2 text-xs text-stone-500">The owner has chosen to hide the exact address. The shaded area shows the general neighborhood.</p>}
              </>
            ) : <p className="mt-2 text-sm text-stone-500">The owner hasn't added a map location for this property.</p>}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-wide text-stone-500">Listed by</p>
            {lister ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={lister.name} url={lister.avatarUrl} size="h-12 w-12 text-lg" />
                <div>
                  {lister.role === 'agent' ? <Link to={`/agents/${lister.id}`} className="font-semibold hover:underline">{lister.name}</Link> : <p className="font-semibold">{lister.name}</p>}
                  <p className="text-sm text-stone-500">{lister.role === 'agent' ? 'Real estate agent' : 'Property owner'}</p>
                  {lister.isVerified && <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-sage-600"><BadgeCheck className="h-4 w-4" aria-hidden="true" />Verified</p>}
                </div>
              </div>
            ) : <p className="mt-2 text-sm text-stone-500">Lister details unavailable.</p>}
          </div>

          {canContact && authStatus === 'guest' && (
            <div className="rounded-card bg-white p-5 shadow-card">
              <h2 className="font-sans text-base font-semibold">Interested in this property?</h2>
              <p className="mt-1 text-sm text-stone-500">Log in to message the lister and arrange a viewing.</p>
              <div className="mt-4 grid gap-2"><Button as={Link} to="/login" {...loginState}>Log in</Button><Button as={Link} to="/register" variant="outline">Create an account</Button></div>
            </div>
          )}
          {canContact && isAuthenticated && !user.isEmailVerified && (
            <div role="status" className="flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <MailWarning className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><span>Verify your email address to contact the lister. <Link to="/dashboard" className="font-medium underline">Go to your dashboard</Link></span>
            </div>
          )}
          {canContact && isAuthenticated && user.isEmailVerified && (
            <>
              <InquiryForm key={p.id} property={p} />
              <Button variant="outline" className="w-full bg-white" onClick={() => setViewingOpen(true)}><CalendarPlus className="h-4 w-4" aria-hidden="true" />Request a viewing</Button>
            </>
          )}

          <div className="rounded-card bg-white p-5 text-sm shadow-card">
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-stone-500">Reference ID</dt><dd className="font-mono font-medium">{p.referenceId}</dd></div>
              {p.publishedAt && <div className="flex justify-between"><dt className="text-stone-500">Published</dt><dd>{formatDate(p.publishedAt)}</dd></div>}
              <div className="flex justify-between"><dt className="text-stone-500">Updated</dt><dd>{formatDate(p.updatedAt)}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2">
              {p.status === 'published' && !isPreview && <FavoriteButton propertyId={p.id} title={p.title} label className="h-11 w-full border border-stone-300 bg-white" />}
              <Button variant="outline" onClick={share}><Share2 className="h-4 w-4" aria-hidden="true" />Share listing</Button>
              {viewer?.canEdit && <Button as={Link} to={`/dashboard/properties/${p.id}/edit`} variant="accent"><Pencil className="h-4 w-4" aria-hidden="true" />Edit listing</Button>}
              {canContact && (
                <button type="button" className="flex items-center justify-center gap-1.5 pt-1 text-xs text-stone-500 hover:text-red-700 hover:underline"
                  onClick={() => (isAuthenticated ? setReportOpen(true) : (toast.error('Log in to report a listing.'), null))}><Flag className="h-3.5 w-3.5" aria-hidden="true" />Report this listing</button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {canContact && isAuthenticated && (
        <>
          <ViewingModal open={viewingOpen} onClose={() => setViewingOpen(false)} property={p} />
          <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} property={p} />
        </>
      )}

      {similar.data?.properties?.length > 0 && (
        <section className="mt-14"><h2 className="mb-5 text-2xl font-semibold">Similar properties</h2><PropertyGrid items={similar.data.properties} count={3} /></section>
      )}
    </div>
  );
}
