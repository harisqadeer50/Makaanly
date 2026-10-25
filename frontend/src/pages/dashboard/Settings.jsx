import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/auth';
import { usersApi } from '../../services/marketplace';
import PasswordInput from '../../components/auth/PasswordInput';
import { FormError } from '../../components/auth/AuthShell';
import Button from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { changePasswordSchema } from '../../utils/authSchemas';
import { applyServerErrors, errorMessage } from '../../utils/applyServerErrors';

const Card = ({ id, title, children }) => <section className="rounded-card bg-white p-5 shadow-card sm:p-7" aria-labelledby={id}><h2 id={id} className="mb-4 font-sans text-lg font-semibold">{title}</h2>{children}</section>;

function PasswordForm() {
  const toast = useToast();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(changePasswordSchema) });
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try { await authApi.changePassword(values); toast.success('Password changed. Other devices were signed out.'); reset(); } catch (e) { setFormError(applyServerErrors(e, setError)); }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <PasswordInput label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
      <PasswordInput label="New password" autoComplete="new-password" hint="At least 8 characters with a letter and a number" error={errors.password?.message} {...register('password')} />
      <PasswordInput label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      <p className="text-sm text-stone-500">Changing your password signs you out on your other devices.</p>
      <Button type="submit" loading={isSubmitting}>Change password</Button>
    </form>
  );
}

function EmailPreference() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const on = user.notificationPrefs?.email !== false;
  const toggle = async (e) => {
    const next = e.target.checked; // read now: a controlled checkbox snaps back to its old value while the request is in flight
    setBusy(true);
    try { setUser((await usersApi.setPreferences({ emailNotifications: next })).user); toast.success(next ? 'Email notifications are on.' : 'Email notifications are off.'); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-sage-500" checked={on} disabled={busy} onChange={toggle} />
        <span><span className="font-medium">Email me about new messages, viewing requests and changes to my listings</span>
          <span className="mt-0.5 block text-stone-500">You will still see everything in your notifications here. We always email you about security (such as a password change) and about decisions on listings and verification.</span></span>
      </label>
    </div>
  );
}

function SignOutEverywhere() {
  const { setUser } = useAuth();
  const toast = useToast(); const navigate = useNavigate(); const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await authApi.logoutAll(); qc.clear(); setUser(null); toast.success('You were signed out on all devices.'); navigate('/login', { replace: true }); }
    catch (e) { toast.error(errorMessage(e)); setBusy(false); setOpen(false); }
  };
  return (
    <>
      <p className="mb-4 text-sm text-stone-600">Lost a phone, or used a shared computer? End every session, including this one.</p>
      <Button variant="outline" onClick={() => setOpen(true)}>Sign out of all devices</Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={run} loading={busy} danger title="Sign out everywhere?" confirmLabel="Sign out everywhere" message="You will be signed out on this device and every other one, and will need to log in again." />
    </>
  );
}

export default function Settings() {
  usePageTitle('Settings');
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <Card id="pw-h" title="Change password"><PasswordForm /></Card>
      <Card id="mail-h" title="Email notifications"><EmailPreference /></Card>
      <Card id="sess-h" title="Sessions"><SignOutEverywhere /></Card>
    </div>
  );
}
