import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Button from '../common/Button';
import { CITIES } from '../../utils/locations';
import { useActiveTypes } from '../../hooks/useCategories';
import { formatPKR } from '../../utils/format';
import { DEFAULT_FILTERS, COMMERCIAL_TYPES, toSearchParams } from '../../utils/searchParams';
import { cn } from '../../utils/cn';

const TABS = [{ id: 'sale', label: 'Buy' }, { id: 'rent', label: 'Rent' }, { id: 'commercial', label: 'Commercial' }];
const field = 'h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-navy-900 placeholder:text-stone-500 focus:border-sage-500';
const Label = ({ htmlFor, children }) => <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-stone-500">{children}</label>;

export default function HeroSearch() {
  const navigate = useNavigate();
  const allTypes = useActiveTypes();
  const [tab, setTab] = useState('sale');
  const [where, setWhere] = useState('');
  const [type, setType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const commercial = tab === 'commercial';
  const types = commercial ? allTypes.filter((t) => COMMERCIAL_TYPES.includes(t.value)) : allTypes.filter((t) => !COMMERCIAL_TYPES.includes(t.value));
  const swap = minPrice && maxPrice && Number(minPrice) > Number(maxPrice);

  const onTab = (id) => { setTab(id); setType(''); setBedrooms(''); };
  const submit = (e) => {
    e.preventDefault();
    if (swap) return;
    const place = where.trim();
    const city = CITIES.find((c) => c.name.toLowerCase() === place.toLowerCase());
    navigate({ pathname: '/properties', search: toSearchParams({
      ...DEFAULT_FILTERS,
      purpose: commercial ? '' : tab,
      type: type ? [type] : commercial ? COMMERCIAL_TYPES : [],
      city: city?.name || '', q: city ? '' : place, // a known city filters exactly; anything else is a keyword search (areas, projects)
      minPrice, maxPrice, bedrooms: commercial || type === 'plot' ? '' : bedrooms,
    }).toString() });
  };

  return (
    <form onSubmit={submit} className="rounded-card bg-white p-4 text-navy-900 shadow-xl sm:p-5" aria-label="Search properties">
      <div className="mb-4 flex gap-1" role="tablist" aria-label="What are you looking for?">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
            className={cn('rounded-full px-4 py-2 text-sm font-medium', tab === t.id ? 'bg-navy-900 text-white' : 'text-navy-800 hover:bg-stone-100')}>{t.label}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="sm:col-span-2 lg:col-span-1"><Label htmlFor="hs-where">City or neighborhood</Label>
          <input id="hs-where" className={field} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. Lahore or Bahria Town" list="hs-cities" autoComplete="off" />
          <datalist id="hs-cities">{CITIES.map((c) => <option key={c.name} value={c.name} />)}</datalist></div>
        <div><Label htmlFor="hs-type">Property type</Label>
          <select id="hs-type" className={field} value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div><Label htmlFor="hs-min">Min price (PKR)</Label>
          <input id="hs-min" className={field} type="number" min="0" inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Any" aria-describedby="hs-min-hint" />
          <p id="hs-min-hint" className="mt-0.5 h-4 text-xs text-stone-500">{minPrice ? formatPKR(minPrice) : ''}</p></div>
        <div><Label htmlFor="hs-max">Max price (PKR)</Label>
          <input id="hs-max" className={cn(field, swap && 'border-red-600')} type="number" min="0" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Any" aria-invalid={swap} aria-describedby="hs-max-hint" />
          <p id="hs-max-hint" role={swap ? 'alert' : undefined} className={cn('mt-0.5 h-4 text-xs', swap ? 'text-red-700' : 'text-stone-500')}>{swap ? 'Max is below min' : maxPrice ? formatPKR(maxPrice) : ''}</p></div>
        <Button type="submit" size="lg" className="h-12 sm:col-span-2 lg:col-span-1" disabled={swap}><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
      </div>
      {!commercial && type !== 'plot' && (
        <div className="mt-1 max-w-[12rem]"><Label htmlFor="hs-beds">Bedrooms</Label>
          <select id="hs-beds" className={field} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}><option value="">Any</option>{['1', '2', '3', '4', '5'].map((n) => <option key={n} value={n}>{n}+</option>)}</select></div>
      )}
    </form>
  );
}
