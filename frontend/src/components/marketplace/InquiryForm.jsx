import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareText } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import { Textarea } from '../common/FormFields';
import { FormError } from '../auth/AuthShell';
import { inquiriesApi } from '../../services/marketplace';

export default function InquiryForm({ property }) {
  const [message, setMessage] = useState(`Hello, I'm interested in "${property.title}". Is it still available?`);
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null); // { id, existing }

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (message.trim().length < 10) { setErrors({ message: 'Write at least 10 characters' }); return; }
    setErrors({}); setBusy(true);
    try {
      const { inquiry } = await inquiriesApi.create({ propertyId: property.id, message: message.trim(), ...(phone.trim() && { phone: phone.trim() }) });
      setSent({ id: inquiry.id });
    } catch (err) {
      if (err.code === 'INQUIRY_EXISTS') setSent({ id: err.errors?.find((x) => x.field === 'inquiryId')?.message, existing: true });
      else {
        const byField = Object.fromEntries((err.errors || []).filter((x) => x.field).map((x) => [x.field, x.message]));
        if (Object.keys(byField).length) setErrors(byField); else setFormError(err.message);
      }
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div role="status" className="rounded-card bg-white p-5 shadow-card">
        <p className="flex items-start gap-2 text-sm"><MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-sage-600" aria-hidden="true" />
          <span>{sent.existing ? 'You already have a conversation about this property.' : 'Your message has been sent. The lister will reply in your inbox.'}</span></p>
        <Button as={Link} to={sent.id ? `/dashboard/inquiries/${sent.id}` : '/dashboard/inquiries?tab=sent'} variant="outline" className="mt-4 w-full">Open conversation</Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-card bg-white p-5 shadow-card" aria-label="Contact the lister">
      <h2 className="font-sans text-base font-semibold">Contact the lister</h2>
      <FormError message={formError} />
      <Textarea label="Your message" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} error={errors.message} />
      <Input label="Phone (optional)" type="tel" autoComplete="tel" placeholder="+92 300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} hint="Shared only with the lister." />
      <Button type="submit" className="w-full" loading={busy}>Send message</Button>
    </form>
  );
}
