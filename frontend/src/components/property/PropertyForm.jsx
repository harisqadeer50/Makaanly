import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Check, MapPinOff } from 'lucide-react';
import Input from '../common/Input';
import { Select, Textarea } from '../common/FormFields';
import Button from '../common/Button';
import Skeleton from '../common/Skeleton';
import Badge from '../common/Badge';
import { FormError } from '../auth/AuthShell';
import PropertyCard from './PropertyCard';
import ImageUploader from './ImageUploader';
import OwnerPicker from '../admin/OwnerPicker';
import { useActiveTypes } from '../../hooks/useCategories';
import { useToast } from '../common/Toast';
import { propertiesApi } from '../../services/properties';
import { applyServerErrors, errorMessage } from '../../utils/applyServerErrors';
import { syncImages } from '../../utils/imageSync';
import { useImageDraft } from '../../hooks/useImageDraft';
import { CITIES, cityCenter } from '../../utils/locations';
import { PURPOSES, PROPERTY_TYPES, CONDITIONS, FURNISHING, RENTAL_PERIODS, AREA_UNITS, AMENITIES, STATUS_LABELS, STATUS_TONES } from '../../utils/propertyOptions';
import { propertyFormSchema, STEPS, stepOfField, emptyForm, toPayload, fromProperty } from '../../utils/propertyForm';
import { cn } from '../../utils/cn';

const LocationMap = lazy(() => import('./LocationMap'));
const num = { setValueAs: (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v)) };
const numberProps = { type: 'number', inputMode: 'decimal', step: 'any', min: 0 };

function Steps({ current, onGo }) {
  return (
    <ol className="mb-8 flex flex-wrap gap-2" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s.id}>
          <button type="button" disabled={i > current} onClick={() => onGo(i)} aria-current={i === current ? 'step' : undefined}
            className={cn('flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium', i === current ? 'bg-navy-900 text-white' : i < current ? 'bg-sage-100 text-sage-700' : 'bg-stone-100 text-stone-500')}>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/25 text-xs">{i < current ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}</span>{s.label}
          </button>
        </li>
      ))}
    </ol>
  );
}

function Summary({ rows }) {
  return <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-stone-100 py-1.5 text-sm"><dt className="text-stone-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>;
}

export default function PropertyForm({ property, basePath = '/dashboard/properties', admin = false }) {
  const types = useActiveTypes(property?.propertyType);
  const [ownerId, setOwnerId] = useState('');
  const [saved, setSaved] = useState(property); // set after the first save, so retries update instead of creating a duplicate
  const editing = !!saved;
  const status = saved?.status;
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(null); // 'save' | 'submit'
  const draft = useImageDraft(property?.images);
  const photosStep = STEPS.findIndex((x) => x.id === 'photos');
  const reviewStep = STEPS.length - 1;

  const { register, control, handleSubmit, trigger, getValues, setValue, setError, watch, formState: { errors } } = useForm({
    resolver: zodResolver(propertyFormSchema), defaultValues: editing ? fromProperty(property) : emptyForm, shouldFocusError: true,
  });
  const purpose = watch('purpose');
  const city = watch('location.city');
  const err = (name) => name.split('.').reduce((o, k) => o?.[k], errors)?.message;

  const next = async () => { if (await trigger(STEPS[step].fields)) setStep((s) => s + 1); };

  const submit = (submitForReview) => handleSubmit(async (values) => {
    setFormError(null);
    if (admin && !saved && !ownerId) { setFormError('Choose the owner or agent this listing belongs to.'); setStep(0); return; }
    if (submitForReview && draft.items.length < 1) {
      setFormError(`Add at least one photo before ${admin ? 'publishing' : 'submitting for review'}.`); setStep(photosStep); return;
    }
    setSubmitting(submitForReview ? 'submit' : 'save');
    let listing = saved;
    try {
      const body = toPayload(values);
      listing = (editing ? await propertiesApi.update(saved.id, body) : await propertiesApi.create(admin && ownerId ? { ...body, ownerId } : body)).property;
      setSaved(listing);

      const result = await syncImages({
        propertyId: listing.id, items: draft.items, removedIds: draft.removedIds, coverKey: draft.coverKey, dirty: draft.dirty,
        api: propertiesApi, onItem: draft.patchItem, onRemoved: draft.markRemoved,
      });
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['property'] });
      if (!result.ok) {
        // The listing itself is saved. Stay here so the failed photos can be retried or removed.
        toast.error('Your listing was saved, but some photos need attention.');
        setFormError('Some photos could not be saved. Retry them or remove them, then save again.');
        setStep(photosStep);
        return;
      }
      if (result.property) draft.adopt(result.property.images);

      if (submitForReview) {
        try { await propertiesApi.setStatus(listing.id, admin ? 'published' : 'pending_review'); }
        catch (e) { toast.error(`Saved, but it could not be ${admin ? 'published' : 'submitted'}: ${errorMessage(e)}`); navigate(`${basePath}/${listing.id}/edit`, { replace: true }); return; }
      }
      toast.success(submitForReview ? (admin ? 'Listing published.' : 'Submitted for review. We will notify you once it is approved.') : editing ? 'Changes saved.' : 'Draft saved.');
      navigate(basePath);
    } catch (e) {
      const message = applyServerErrors(e, setError);
      setFormError(message || 'Please fix the highlighted fields.');
      const first = (e.errors || []).find((x) => x.field);
      if (first) setStep(stepOfField(first.field));
    } finally { setSubmitting(null); }
  }, (invalid) => { // client-side failure on the final step: jump to the first step with an error
    const first = Object.keys(invalid)[0];
    setStep(stepOfField(first === 'location' ? `location.${Object.keys(invalid.location)[0]}` : first));
    setFormError('Please fix the highlighted fields.');
  });

  const preview = () => {
    const v = getValues(); let p;
    try { p = toPayload({ ...emptyForm, ...v, location: { ...emptyForm.location, ...v.location } }); } catch { return null; }
    const photos = [...draft.items].sort((a, b) => Number(b.key === draft.coverKey) - Number(a.key === draft.coverKey))
      .map((i) => ({ id: i.key, url: i.previewUrl || i.url, altText: i.altText }));
    return { ...p, id: 'preview', slug: '', images: photos, location: p.location, isFeatured: false, owner: null };
  };
  const pv = step === reviewStep ? preview() : null;
  const coords = watch('location.coordinates');

  const submitLabel = admin ? 'Publish now' : status === 'rejected' ? 'Save and resubmit' : 'Submit for review';
  const showSubmit = admin ? (!editing || status === 'draft') : (!editing || ['draft', 'rejected'].includes(status));
  const saveLabel = !editing || status === 'draft' ? 'Save draft' : 'Save changes';

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="max-w-3xl">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{editing ? 'Edit property' : admin ? 'Add a listing' : 'Add a property'}</h1>
        {editing && <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>}
      </div>
      {editing && status === 'rejected' && saved.rejectionReason && (
        <p role="note" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900"><strong>Rejected:</strong> {saved.rejectionReason}. Update the listing and resubmit it.</p>
      )}
      {editing && status === 'published' && <p className="mb-4 text-sm text-stone-500">Changing the title, description, type, purpose or neighborhood sends this listing back for review.</p>}
      <Steps current={step} onGo={setStep} />
      <FormError message={formError} />

      <div className="rounded-card bg-white p-5 shadow-card sm:p-7">
        {step === 0 && (
          <div className="space-y-5">
            {admin && !editing && <OwnerPicker value={ownerId} onChange={setOwnerId} error={!ownerId && formError?.startsWith('Choose the owner') ? 'Choose who owns this listing' : undefined} />}
            <Input label="Title" placeholder="e.g. 5 Marla house near park in Bahria Town" error={err('title')} {...register('title')} />
            <Textarea label="Description" hint="Describe the layout, condition, surroundings and anything buyers should know." error={err('description')} {...register('description')} />
            <div className="grid gap-5 sm:grid-cols-3">
              <Select label="Purpose" options={PURPOSES} error={err('purpose')} {...register('purpose')} />
              <Select label="Property type" options={types} placeholder="Choose type" error={err('propertyType')} {...register('propertyType')} />
              <Select label="Condition" options={CONDITIONS} error={err('condition')} {...register('condition')} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
              <Input label={purpose === 'rent' ? 'Rent' : 'Asking price'} {...numberProps} error={err('price')} {...register('price', num)} />
              <Select label="Currency" options={[{ value: 'PKR', label: 'PKR' }, { value: 'USD', label: 'USD' }]} error={err('currency')} {...register('currency')} />
            </div>
            {purpose === 'rent' && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Select label="Rent period" options={RENTAL_PERIODS} error={err('rentalPeriod')} {...register('rentalPeriod')} />
                <Input label="Security deposit (optional)" {...numberProps} error={err('securityDeposit')} {...register('securityDeposit', num)} />
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Maintenance charges (optional)" {...numberProps} error={err('maintenanceCharges')} {...register('maintenanceCharges', num)} />
              <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-sage-500" {...register('negotiable')} />Price is negotiable</label>
            </div>
            <fieldset className="grid gap-5 sm:grid-cols-3">
              <legend className="mb-1.5 text-sm font-medium text-navy-800 sm:col-span-3">Area <span className="font-normal text-stone-500">(enter covered area, plot area, or both)</span></legend>
              <Input label="Covered area" {...numberProps} error={err('coveredArea')} {...register('coveredArea', num)} />
              <Input label="Plot area" {...numberProps} error={err('plotArea')} {...register('plotArea', num)} />
              <Select label="Unit" options={AREA_UNITS} error={err('areaUnit')} hint="1 marla = 272.25 sq ft" {...register('areaUnit')} />
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Input label="Bedrooms" {...numberProps} error={err('bedrooms')} {...register('bedrooms', num)} />
              <Input label="Bathrooms" {...numberProps} error={err('bathrooms')} {...register('bathrooms', num)} />
              <Input label="Kitchens" {...numberProps} error={err('kitchens')} {...register('kitchens', num)} />
              <Input label="Floors" {...numberProps} error={err('floors')} {...register('floors', num)} />
              <Input label="Parking spaces" {...numberProps} error={err('parkingSpaces')} {...register('parkingSpaces', num)} />
              <Input label="Year built" {...numberProps} error={err('constructionYear')} {...register('constructionYear', num)} />
            </div>
            <Select label="Furnishing" options={FURNISHING} placeholder="Not specified" error={err('furnishing')} className="sm:w-1/2" {...register('furnishing')} />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-navy-800">Amenities</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AMENITIES.map((a) => <label key={a.value} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"><input type="checkbox" value={a.value} className="h-4 w-4 accent-sage-500" {...register('amenities')} />{a.label}</label>)}
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Select label="City" options={CITIES.map((c) => ({ value: c.name, label: c.name }))} placeholder="Choose city" error={err('location.city')} {...register('location.city')} />
              <Input label="Neighborhood" placeholder="e.g. Bahria Town" error={err('location.neighborhood')} {...register('location.neighborhood')} />
              <Input label="Block / phase (optional)" error={err('location.area')} {...register('location.area')} />
              <Input label="Street address (optional)" error={err('location.street')} {...register('location.street')} />
            </div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-sage-500" {...register('location.hideExactAddress')} />
              <span><strong>Hide my exact address</strong><br /><span className="text-stone-500">Buyers see only the neighborhood and an approximate area on the map. Recommended.</span></span></label>
            <div>
              <p className="mb-2 text-sm font-medium text-navy-800">Pin the location on the map <span className="font-normal text-stone-500">(optional)</span></p>
              {city ? (
                <>
                  <Controller control={control} name="location.coordinates" render={({ field }) => (
                    <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                      <LocationMap center={cityCenter(city)} point={field.value || undefined} onPick={field.onChange} approximate={false} />
                    </Suspense>
                  )} />
                  <div className="mt-2 flex items-center gap-3 text-sm text-stone-500">
                    {coords ? <span>Pin set at {coords.lat}, {coords.lng}</span> : <span>Click the map to drop a pin.</span>}
                    {coords && <Button type="button" size="sm" variant="ghost" onClick={() => setValue('location.coordinates', null, { shouldDirty: true })}><MapPinOff className="h-4 w-4" aria-hidden="true" />Remove pin</Button>}
                  </div>
                </>
              ) : <p className="rounded-lg bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">Choose a city to place a pin.</p>}
            </div>
          </div>
        )}

        {step === photosStep && <ImageUploader draft={draft} busy={!!submitting} onRetry={submit(false)} />}

        {step === reviewStep && (() => {
          const v = getValues();
          return (
            <div className="space-y-6">
              <div><h2 className="mb-3 text-lg font-semibold">Review your listing</h2>
                <Summary rows={[['Title', v.title], ['Purpose', PURPOSES.find((p) => p.value === v.purpose)?.label], ['Type', PROPERTY_TYPES.find((p) => p.value === v.propertyType)?.label],
                  ['Price', v.price != null ? `${v.currency} ${Number(v.price).toLocaleString()}` : null], ['Covered area', v.coveredArea ? `${v.coveredArea} ${v.areaUnit}` : null], ['Plot area', v.plotArea ? `${v.plotArea} ${v.areaUnit}` : null],
                  ['Bedrooms', v.bedrooms], ['Bathrooms', v.bathrooms], ['Location', [v.location.neighborhood, v.location.city].filter(Boolean).join(', ')],
                  ['Exact address', v.location.hideExactAddress ? 'Hidden' : 'Shown'], ['Map pin', v.location.coordinates ? 'Set' : 'Not set'], ['Photos', `${draft.items.length}`], ['Amenities', v.amenities?.length ? `${v.amenities.length} selected` : null]]} /></div>
              {pv && <div><p className="mb-2 text-sm font-medium">How it will look in search</p><div className="pointer-events-none max-w-sm select-none" inert="" aria-hidden="true"><PropertyCard property={pv} to="#" /></div></div>}
            </div>
          );
        })()}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={step === 0 || !!submitting} onClick={() => setStep((s) => s - 1)}>Back</Button>
        {step < reviewStep ? (
          <Button type="button" onClick={next}>Continue</Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" loading={submitting === 'save'} disabled={!!submitting} onClick={submit(false)}>{saveLabel}</Button>
            {showSubmit && <Button type="button" variant="accent" loading={submitting === 'submit'} disabled={!!submitting} onClick={submit(true)}>{submitLabel}</Button>}
          </div>
        )}
      </div>
    </form>
  );
}
