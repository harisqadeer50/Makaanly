import { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Textarea } from '../common/FormFields';
import { FormError } from '../auth/AuthShell';
import { useToast } from '../common/Toast';
import { reportsApi } from '../../services/marketplace';

export const REPORT_REASONS = [
  ['misleading_info', 'Misleading or inaccurate information'], ['wrong_price', 'The price is wrong'], ['already_sold', 'Already sold or rented'],
  ['fake_listing', 'Fake listing'], ['suspected_scam', 'I suspect a scam'], ['inappropriate_content', 'Inappropriate content'], ['duplicate', 'Duplicate listing'], ['other', 'Something else'],
];

export default function ReportModal({ open, onClose, property }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!reason) { setErrors({ reason: 'Choose a reason' }); return; }
    if (reason === 'other' && description.trim().length < 10) { setErrors({ description: 'Please describe the problem (at least 10 characters)' }); return; }
    setErrors({}); setBusy(true);
    try {
      await reportsApi.create(property.id, { reason, ...(description.trim() && { description: description.trim() }) });
      toast.success('Thank you. Our team will review this listing.');
      onClose();
      setReason(''); setDescription('');
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Report this listing" sheet>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-stone-500">Tell us what is wrong with “{property.title}”. Reports are reviewed by our team and are not shown to the lister.</p>
        <FormError message={formError} />
        <fieldset>
          <legend className="sr-only">Reason</legend>
          <div className="space-y-1.5">
            {REPORT_REASONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"><input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-sage-500" />{label}</label>
            ))}
          </div>
          {errors.reason && <p role="alert" className="mt-1 text-xs text-red-700">{errors.reason}</p>}
        </fieldset>
        <Textarea label={reason === 'other' ? 'Describe the problem' : 'More details (optional)'} rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" variant="danger" loading={busy}>Submit report</Button></div>
      </form>
    </Modal>
  );
}
