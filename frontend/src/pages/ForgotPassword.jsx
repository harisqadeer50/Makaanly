import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import AuthShell, { FormError } from '../components/auth/AuthShell';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { authApi } from '../services/auth';
import { forgotSchema } from '../utils/authSchemas';

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState(null);
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try { await authApi.forgotPassword(email); setSentTo(email); } catch (err) { setFormError(err.message); }
  });

  if (sentTo) {
    return (
      <AuthShell title="Check your email" footer={<Link to="/login" className="font-medium text-sage-600 hover:underline">Back to log in</Link>}>
        <div className="flex gap-3 text-sm" role="status">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage-600" aria-hidden="true" />
          <p>If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. The link works once and expires in 1 hour.</p>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a reset link."
      footer={<Link to="/login" className="font-medium text-sage-600 hover:underline">Back to log in</Link>}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
    </AuthShell>
  );
}
