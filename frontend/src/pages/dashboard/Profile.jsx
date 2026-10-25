import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { agentsApi, usersApi } from '../../services/marketplace';
import Avatar from '../../components/common/Avatar';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { Textarea } from '../../components/common/FormFields';
import { FormError } from '../../components/auth/AuthShell';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { applyServerErrors, errorMessage } from '../../utils/applyServerErrors';
import { PROPERTY_TYPES } from '../../utils/propertyOptions';

const phoneRule = z.string().trim().regex(/^(\+?[0-9\s-]{7,15})?$/, 'Enter a valid phone number');
const accountSchema = z.object({ name: z.string().trim().min(2, 'Enter your full name').max(80), phone: phoneRule });
const agentSchema = z.object({
  agencyName: z.string().trim().max(80), bio: z.string().trim().min(20, 'Tell clients about yourself in at least 20 characters').max(1500),
  serviceAreas: z.string().max(600), specialties: z.array(z.string()), contactPhone: phoneRule,
  contactEmail: z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address')]),
});
const splitList = (s) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 10);

function AvatarSection() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = async (file) => {
    if (!file) return;
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPEG, PNG or WebP photo.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('That photo is larger than 5 MB.'); return; }
    setBusy(true);
    try { setUser((await usersApi.uploadAvatar(file)).user); toast.success('Profile photo updated.'); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try { setUser((await usersApi.removeAvatar()).user); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-4">
      <Avatar name={user.name} url={user.avatar?.url} size="h-20 w-20 text-2xl" />
      <div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}><Camera className="h-4 w-4" aria-hidden="true" />{user.avatar?.url ? 'Change photo' : 'Add photo'}</Button>
          {user.avatar?.url && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}><Trash2 className="h-4 w-4" aria-hidden="true" />Remove</Button>}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload profile photo" onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
        {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}

function AccountForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting, isDirty } } = useForm({ resolver: zodResolver(accountSchema), defaultValues: { name: user.name, phone: user.phone || '' } });
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try { setUser((await usersApi.update({ name: v.name, phone: v.phone })).user); toast.success('Profile saved.'); } catch (e) { setFormError(applyServerErrors(e, setError)); }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
      <Input label="Phone" type="tel" autoComplete="tel" placeholder="+92 300 1234567" error={errors.phone?.message} {...register('phone')} />
      <Input label="Email" value={user.email} readOnly disabled hint="Your email address is your login and cannot be changed here." />
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
    </form>
  );
}

function AgentForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const p = user.agentProfile || {};
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(agentSchema),
    defaultValues: { agencyName: p.agencyName || '', bio: p.bio || '', serviceAreas: (p.serviceAreas || []).join(', '), specialties: p.specialties || [], contactPhone: p.contactPhone || '', contactEmail: p.contactEmail || '' },
  });
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const res = await agentsApi.saveProfile({ agencyName: v.agencyName || null, bio: v.bio, serviceAreas: splitList(v.serviceAreas), specialties: v.specialties, contactPhone: v.contactPhone || null, contactEmail: v.contactEmail || null });
      setUser(res.user); toast.success('Public profile saved.');
    } catch (e) { setFormError(applyServerErrors(e, setError)); }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <Input label="Agency name (optional)" error={errors.agencyName?.message} {...register('agencyName')} />
      <Textarea label="About you" rows={5} hint="Visible to everyone on your public profile." error={errors.bio?.message} {...register('bio')} />
      <Input label="Areas you cover" placeholder="e.g. DHA, Gulberg, Bahria Town" hint="Separate with commas (up to 10)." error={errors.serviceAreas?.message} {...register('serviceAreas')} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-navy-800">Specialties</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROPERTY_TYPES.map((t) => <label key={t.value} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"><input type="checkbox" value={t.value} className="h-4 w-4 accent-sage-500" {...register('specialties')} />{t.label}</label>)}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Public phone (optional)" type="tel" hint="Shown on your public profile." error={errors.contactPhone?.message} {...register('contactPhone')} />
        <Input label="Public email (optional)" type="email" hint="Shown on your public profile." error={errors.contactEmail?.message} {...register('contactEmail')} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isSubmitting}>Save public profile</Button>
        {p.isListed && <Link to={`/agents/${user.id}`} className="text-sm font-medium text-sage-600 hover:underline">View public profile</Link>}
      </div>
    </form>
  );
}

export default function Profile() {
  usePageTitle('Profile');
  const { user } = useAuth();
  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Profile</h1>
      <section className="rounded-card bg-white p-5 shadow-card sm:p-7" aria-labelledby="account-h"><h2 id="account-h" className="mb-5 font-sans text-lg font-semibold">Your account</h2><div className="space-y-6"><AvatarSection /><AccountForm /></div></section>
      {user.role === 'agent' && (
        <section className="rounded-card bg-white p-5 shadow-card sm:p-7" aria-labelledby="agent-h">
          <h2 id="agent-h" className="font-sans text-lg font-semibold">Public agent profile</h2>
          <p className="mb-5 mt-1 text-sm text-stone-500">Saving this puts you in the agent directory.</p>
          <AgentForm />
        </section>
      )}
    </div>
  );
}
