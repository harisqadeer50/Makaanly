import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { Textarea } from '../common/FormFields';
import { FormError } from '../auth/AuthShell';
import SlotPicker from './SlotPicker';
import { appointmentsApi } from '../../services/marketplace';
import { pktToIso, formatRange } from '../../utils/datetime';

const EMPTY = { date: '', time: '', duration: 30 };

export default function ViewingModal({ open, onClose, property }) {
  const [slot, setSlot] = useState(EMPTY);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const close = () => { onClose(); setTimeout(() => { setDone(null); setErrors({}); setFormError(null); }, 200); };

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!slot.date || !slot.time) { setErrors({ time: 'Choose a date and a start time' }); return; }
    setErrors({}); setBusy(true);
    try {
      const { appointment } = await appointmentsApi.create({
        propertyId: property.id, start: pktToIso(slot.date, slot.time), durationMinutes: slot.duration,
        ...(message.trim() && { message: message.trim() }), ...(phone.trim() && { phone: phone.trim() }),
      });
      setDone(appointment);
    } catch (err) {
      const field = (err.errors || []).find((x) => x.field === 'start');
      if (field || err.code === 'SLOT_TAKEN') setErrors({ time: field?.message || err.message });
      else if ((err.errors || []).find((x) => x.field === 'phone')) setErrors({ phone: err.errors.find((x) => x.field === 'phone').message });
      else setFormError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title="Request a viewing" sheet>
      {done ? (
        <div role="status" className="space-y-4 text-sm">
          <p className="flex items-start gap-2"><CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage-600" aria-hidden="true" />
            <span>Your request for <strong>{formatRange(done.start, done.end)}</strong> has been sent. You will see the lister's answer in your dashboard.</span></p>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Close</Button><Button as={Link} to="/dashboard/appointments">View my viewings</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <p className="text-sm text-stone-500">{property.title}</p>
          <FormError message={formError} />
          <SlotPicker value={slot} onChange={setSlot} error={errors.time} />
          <Input label="Phone (optional)" type="tel" autoComplete="tel" placeholder="+92 300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} hint="Shared only with the lister." />
          <Textarea label="Message (optional)" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" loading={busy}>Send request</Button></div>
        </form>
      )}
    </Modal>
  );
}
