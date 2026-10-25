import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthShell, { FormError } from '../components/auth/AuthShell';
import PasswordInput from '../components/auth/PasswordInput';
import Button from '../components/common/Button';
import { useToast } from '../components/common/Toast';
import { authApi } from '../services/auth';
import { resetSchema } from '../utils/authSchemas';
import { applyServerErrors } from '../utils/applyServerErrors';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authApi.resetPassword({ token, ...values });
      toast.success('Password updated. Log in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) { setFormError(applyServerErrors(err, setError)); }
  });

  if (!token) {
    return (
      <AuthShell title="Reset link is missing" footer={<Link to="/forgot-password" className="font-medium text-sage-600 hover:underline">Request a new link</Link>}>
        <FormError message="Open the link from your email, or request a new one." />
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed out on all devices.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <PasswordInput label="New password" autoComplete="new-password" hint="At least 8 characters with a letter and a number" error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </AuthShell>
  );
}
