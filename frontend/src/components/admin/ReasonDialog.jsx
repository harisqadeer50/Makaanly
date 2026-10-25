import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Textarea } from '../common/FormFields';

// Asks for a short written reason before a consequential action, and refuses to continue without one.
export default function ReasonDialog({ open, onClose, onConfirm, title, message, confirmLabel, label = 'Reason', min = 5, optional = false, danger = false, loading = false, children }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setText(''); setError(null); } }, [open]);

  const submit = (e) => {
    e.preventDefault();
    if (!optional && text.trim().length < min) { setError(`Please write at least ${min} characters.`); return; }
    onConfirm(text.trim());
  };
  return (
    <Modal open={open} onClose={onClose} title={title} sheet>
      <form onSubmit={submit} noValidate className="space-y-4">
        {message && <p className="text-sm text-stone-700">{message}</p>}
        {children}
        <Textarea label={optional ? `${label} (optional)` : label} rows={3} maxLength={500} value={text} onChange={(e) => { setText(e.target.value); setError(null); }} error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={loading}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
