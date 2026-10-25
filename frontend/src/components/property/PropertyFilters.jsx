import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocateFixed, X } from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import { Select } from '../common/FormFields';
import { propertiesApi } from '../../services/properties';
import { CITIES } from '../../utils/locations';
import { formatPKR } from '../../utils/format';
import { PURPOSES, FURNISHING, CONDITIONS, AREA_UNITS, AMENITIES } from '../../utils/propertyOptions';
import { DEFAULT_FILTERS, POSTED_OPTIONS } from '../../utils/searchParams';
import { useActiveTypes } from '../../hooks/useCategories';
import { cn } from '../../utils/cn';

const ROOMS = ['', '1', '2', '3', '4', '5'];

function Segmented({ legend, value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-navy-800">{legend}</legend>
      <div className="flex gap-1.5">
        {ROOMS.map((r) => (
          <button key={r || 'any'} type="button" aria-pressed={value === r} onClick={() => onChange(r)}
            className={cn('h-10 flex-1 rounded-lg border text-sm font-medium', value === r ? 'border-navy-900 bg-navy-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-100')}>
            {r === '' ? 'Any' : r === '5' ? '5+' : r}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
const Section = ({ title, level: Tag = 'h2', children }) => <section className="space-y-3 border-b border-stone-200 pb-5 last:border-0"><Tag className="font-sans text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</Tag>{children}</section>;

// mode "live": changes apply as you make them (selects at once, typed numbers after a short pause).
// mode "manual": changes stay in a draft until "Show results" (used in the mobile sheet).
export default function PropertyFilters({ value, onChange, mode = 'live', onDone, headingLevel = 'h2', label = 'Filters' }) {
  const typeOptions = useActiveTypes(value.type[0]);
  const [draft, setDraft] = useState(value);
  const [geoError, setGeoError] = useState(null);
  const timer = useRef(null);
  useEffect(() => setDraft(value), [value]); // e.g. a chip was removed
  useEffect(() => () => clearTimeout(timer.current), []);

  const locations = useQuery({ queryKey: ['locations', draft.city || ''], queryFn: () => propertiesApi.locations(draft.city), staleTime: 120000 });
  const cities = locations.data?.cities || CITIES.map((c) => ({ name: c.name, count: 0 }));
  const hoods = locations.data?.neighborhoods || [];

  const set = (patch, { typed = false } = {}) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (mode !== 'live') return;
    clearTimeout(timer.current);
    if (typed) timer.current = setTimeout(() => onChange(next), 450); else onChange(next);
  };
  const toggle = (key, v) => set({ [key]: draft[key].includes(v) ? draft[key].filter((x) => x !== v) : [...draft[key], v] });

  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const amenities = showAllAmenities ? AMENITIES : AMENITIES.slice(0, 8);

  const nearMe = () => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError('Your browser cannot share your location.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => set({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5), radiusKm: draft.radiusKm || '10' }),
      () => setGeoError('We could not get your location. Check your browser permissions.'),
      { timeout: 10000 },
    );
  };
  const hasNear = draft.lat && draft.lng;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (mode === 'manual') { onChange(draft); onDone?.(); } }} className="space-y-5" aria-label={label}>
      <Section level={headingLevel} title="Looking for">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Purpose" value={draft.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="Buy or rent" options={PURPOSES} />
          <Select label="Posted" value={draft.postedWithin} onChange={(e) => set({ postedWithin: e.target.value })} placeholder="Any time" options={POSTED_OPTIONS} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-navy-800">Property type</legend>
          <div className="flex flex-wrap gap-1.5">
            {typeOptions.map((t) => (
              <button key={t.value} type="button" aria-pressed={draft.type.includes(t.value)} onClick={() => toggle('type', t.value)}
                className={cn('rounded-full border px-3 py-1.5 text-sm', draft.type.includes(t.value) ? 'border-navy-900 bg-navy-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-100')}>{t.label}</button>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section level={headingLevel} title="Location">
        <Select label="City" value={draft.city} onChange={(e) => set({ city: e.target.value, neighborhood: '' })} placeholder="Any city"
          options={cities.map((c) => ({ value: c.name, label: c.count ? `${c.name} (${c.count})` : c.name }))} />
        <Input label="Neighborhood" value={draft.neighborhood} list="neighborhood-options" autoComplete="off" placeholder="e.g. Bahria Town"
          onChange={(e) => set({ neighborhood: e.target.value }, { typed: true })} />
        <datalist id="neighborhood-options">{hoods.map((h) => <option key={h.name} value={h.name} />)}</datalist>
        {hasNear ? (
          <div className="flex items-end gap-2">
            <Select label="Distance from you" value={draft.radiusKm || '10'} onChange={(e) => set({ radiusKm: e.target.value })} className="flex-1"
              options={['5', '10', '25', '50'].map((v) => ({ value: v, label: `Within ${v} km` }))} />
            <Button type="button" variant="outline" aria-label="Stop searching near me" onClick={() => set({ lat: '', lng: '', radiusKm: '' })}><X className="h-4 w-4" /></Button>
          </div>
        ) : <Button type="button" variant="outline" size="sm" onClick={nearMe}><LocateFixed className="h-4 w-4" aria-hidden="true" />Near me</Button>}
        {geoError && <p role="alert" className="text-xs text-red-700">{geoError}</p>}
      </Section>

      <Section level={headingLevel} title="Price (PKR)">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Min" type="number" min="0" inputMode="numeric" value={draft.minPrice} hint={draft.minPrice ? formatPKR(draft.minPrice) : undefined} onChange={(e) => set({ minPrice: e.target.value }, { typed: true })} />
          <Input label="Max" type="number" min="0" inputMode="numeric" value={draft.maxPrice} hint={draft.maxPrice ? formatPKR(draft.maxPrice) : undefined} onChange={(e) => set({ maxPrice: e.target.value }, { typed: true })}
            error={draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice) ? 'Max is below min' : undefined} />
        </div>
      </Section>

      <Section level={headingLevel} title="Area">
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <Input label="Min" type="number" min="0" inputMode="decimal" value={draft.minArea} onChange={(e) => set({ minArea: e.target.value }, { typed: true })} />
          <Input label="Max" type="number" min="0" inputMode="decimal" value={draft.maxArea} onChange={(e) => set({ maxArea: e.target.value }, { typed: true })} />
        </div>
        <Select label="Unit" value={draft.areaUnit} onChange={(e) => set({ areaUnit: e.target.value })} options={AREA_UNITS} hint="Converted automatically. 1 marla = 272.25 sq ft" />
      </Section>

      <Section level={headingLevel} title="Rooms">
        <Segmented legend="Bedrooms (minimum)" value={draft.bedrooms} onChange={(v) => set({ bedrooms: v })} />
        <Segmented legend="Bathrooms (minimum)" value={draft.bathrooms} onChange={(v) => set({ bathrooms: v })} />
      </Section>

      <Section level={headingLevel} title="More">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Furnishing" value={draft.furnishing} onChange={(e) => set({ furnishing: e.target.value })} placeholder="Any" options={FURNISHING} />
          <Select label="Condition" value={draft.condition} onChange={(e) => set({ condition: e.target.value })} placeholder="Any" options={CONDITIONS} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-sage-500" checked={draft.verified} onChange={(e) => set({ verified: e.target.checked })} />Verified listers only</label>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-navy-800">Amenities</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {amenities.map((a) => (
              <label key={a.value} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-sage-500" checked={draft.amenities.includes(a.value)} onChange={() => toggle('amenities', a.value)} />{a.label}</label>
            ))}
          </div>
          <button type="button" className="mt-2 text-sm font-medium text-sage-600 hover:underline" onClick={() => setShowAllAmenities((s) => !s)}>{showAllAmenities ? 'Show fewer' : `Show all ${AMENITIES.length}`}</button>
        </fieldset>
      </Section>

      <div className={cn('flex gap-2', mode === 'manual' && 'sticky bottom-0 -mx-5 border-t border-stone-200 bg-white px-5 py-3')}>
        <Button type="button" variant="outline" className="flex-1" onClick={() => { const cleared = { ...DEFAULT_FILTERS, q: draft.q, sort: draft.sort }; setDraft(cleared); if (mode === 'live') onChange(cleared); }}>Clear filters</Button>
        {mode === 'manual' && <Button type="submit" className="flex-1">Show results</Button>}
      </div>
    </form>
  );
}
