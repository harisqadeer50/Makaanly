import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthShell, { FormError } from '../components/auth/AuthShell';
import PasswordInput from '../components/auth/PasswordInput';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import { registerSchema } from '../utils/authSchemas';
import { applyServerErrors } from '../utils/applyServerErrors';
import { cn } from '../utils/cn';

const ROLES = [
  { value: 'buyer', label: 'Buy or rent', hint: 'Find a home' },
  { value: 'owner', label: 'Property owner', hint: 'List my property' },
  { value: 'agent', label: 'Real estate agent', hint: 'Manage listings' },
];

export default function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema), defaultValues: { role: 'buyer', acceptTerms: false },
  });
  const role = watch('role');

  const onSubmit = handleSubmit(async ({ phone, ...values }) => {
    setFormError(null);
    try {
      await signUp({ ...values, ...(phone ? { phone } : {}) });
      toast.success('Account created. Check your email to verify your address.');
      navigate('/dashboard', { replace: true });
    } catch (err) { setFormError(applyServerErrors(err, setError)); }
  });

  return (
    <AuthShell title="Create your account" subtitle="It takes a minute."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-sage-600 hover:underline">Log in</Link></>}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-navy-800">I want to</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {ROLES.map((r) => (
              <label key={r.value} className={cn('cursor-pointer rounded-lg border p-3 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-sage-500',
                role === r.value ? 'border-sage-500 bg-sage-50' : 'border-stone-300 bg-white hover:bg-stone-50')}>
                <input type="radio" value={r.value} className="sr-only" {...register('role')} />
                <span className="block font-medium">{r.label}</span><span className="text-xs text-stone-500">{r.hint}</span>
              </label>
            ))}
          </div>
          {errors.role && <p role="alert" className="mt-1 text-xs text-red-700">{errors.role.message}</p>}
        </fieldset>
        <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone (optional)" type="tel" autoComplete="tel" placeholder="+92 300 1234567" error={errors.phone?.message} {...register('phone')} />
        <PasswordInput label="Password" autoComplete="new-password" hint="At least 8 characters with a letter and a number" error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirm password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-sage-500" {...register('acceptTerms')} />
            <span>I agree to the <Link to="/terms" className="text-sage-600 underline">terms</Link> and <Link to="/privacy" className="text-sage-600 underline">privacy policy</Link>.</span>
          </label>
          {errors.acceptTerms && <p role="alert" className="mt-1 text-xs text-red-700">{errors.acceptTerms.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthShell>
  );
}
