import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthShell, { FormError } from '../components/auth/AuthShell';
import PasswordInput from '../components/auth/PasswordInput';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { loginSchema } from '../utils/authSchemas';
import { applyServerErrors } from '../utils/applyServerErrors';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      const from = location.state?.from;
      navigate(from ? `${from.pathname}${from.search || ''}` : '/dashboard', { replace: true });
    } catch (err) { setFormError(applyServerErrors(err, setError)); }
  });

  return (
    <AuthShell title="Welcome back" subtitle="Log in to save properties and manage your listings."
      footer={<>New to Makaanly? <Link to="/register" className="font-medium text-sage-600 hover:underline">Create an account</Link></>}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="text-right text-sm"><Link to="/forgot-password" className="text-sage-600 hover:underline">Forgot password?</Link></div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Log in</Button>
      </form>
    </AuthShell>
  );
}
