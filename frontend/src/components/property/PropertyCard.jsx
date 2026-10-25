import { Link } from 'react-router-dom';
import { Bath, BedDouble, Ruler, MapPin, BadgeCheck, Home } from 'lucide-react';
import Badge from '../common/Badge';
import { formatPrice, primaryArea, locationLine } from '../../utils/format';
import { cloudinaryUrl } from '../../utils/images';
import { PROPERTY_TYPES, labelOf } from '../../utils/propertyOptions';
import { cn } from '../../utils/cn';
import FavoriteButton from '../marketplace/FavoriteButton';

export function ImagePlaceholder({ className = '' }) {
  return <div className={`grid place-items-center bg-navy-50 text-navy-300 ${className}`} aria-hidden="true"><Home className="h-10 w-10" /></div>;
}

export default function PropertyCard({ property: p, to, layout = 'grid', heading: Heading = 'h3' }) {
  const list = layout === 'list';
  const cover = p.images?.[0];
  const area = primaryArea(p);
  return (
    <article className={cn('group relative overflow-hidden rounded-card bg-white shadow-card transition-shadow hover:shadow-lg', list && 'sm:grid sm:grid-cols-[17rem_1fr]')}>
      <div className={cn('relative aspect-[4/3] overflow-hidden bg-stone-100', list && 'sm:aspect-auto sm:h-full sm:min-h-[12rem]')}>
        {cover ? (
          <img src={cloudinaryUrl(cover.url, { w: 640, h: 480 })} alt={cover.altText || p.title} loading="lazy" decoding="async" width="640" height="480"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : <ImagePlaceholder className="h-full w-full" />}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone="navy">{p.purpose === 'rent' ? 'For rent' : 'For sale'}</Badge>
          {p.isFeatured && <Badge tone="green">Featured</Badge>}
        </div>
        {p.id !== 'preview' && <FavoriteButton propertyId={p.id} title={p.title} className="absolute right-3 top-3" />}
      </div>
      <div className="space-y-2.5 p-4">
        <p className="text-xl font-bold text-navy-900">{formatPrice(p)}</p>
        <Heading className="font-sans text-base font-semibold leading-snug">
          {/* The title link stretches over the whole card, so other controls (favorites, later) can sit above it without conflicts. */}
          <Link to={to || `/properties/${p.slug}`} className="after:absolute after:inset-0 after:content-['']">{p.title}</Link>
        </Heading>
        <p className="flex items-center gap-1.5 text-sm text-stone-500"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{locationLine(p.location)}</span></p>
        {list && p.description && <p className="hidden text-sm text-stone-600 sm:line-clamp-2">{p.description}</p>}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-sm text-stone-700">
          {p.bedrooms != null && <li className="flex items-center gap-1.5"><BedDouble className="h-4 w-4" aria-hidden="true" /><span>{p.bedrooms}<span className="sr-only"> bedrooms</span></span></li>}
          {p.bathrooms != null && <li className="flex items-center gap-1.5"><Bath className="h-4 w-4" aria-hidden="true" /><span>{p.bathrooms}<span className="sr-only"> bathrooms</span></span></li>}
          {area && <li className="flex items-center gap-1.5"><Ruler className="h-4 w-4" aria-hidden="true" />{area}</li>}
          <li className="ml-auto text-xs text-stone-500">{labelOf(PROPERTY_TYPES, p.propertyType)}</li>
        </ul>
        {p.owner?.isVerified && <p className="flex items-center gap-1 text-xs font-medium text-sage-600"><BadgeCheck className="h-4 w-4" aria-hidden="true" />Verified lister</p>}
      </div>
    </article>
  );
}
