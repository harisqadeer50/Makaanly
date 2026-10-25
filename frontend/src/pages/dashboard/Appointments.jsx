import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Mail, Phone } from 'lucide-react';
import { appointmentsApi } from '../../services/marketplace';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Modal, { ConfirmDialog } from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import { Select, Textarea } from '../../components/common/FormFields';
import SlotPicker from '../../components/marketplace/SlotPicker';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { formatRange, pktToIso } from '../../utils/datetime';
import { cn } from '../../utils/cn';

const LABELS = { requested: 'Requested', confirmed: 'Confirmed', rescheduled: 'New time proposed', declined: 'Declined', cancelled: 'Cancelled', completed: 'Completed' };
const TONES = { requested: 'amber', confirmed: 'green', rescheduled: 'amber', declined: 'red', cancelled: 'neutral', completed: 'navy' };

// Mirrors backend/src/utils/appointmentRules.js (the API enforces the real rules).
export function actionsFor(a, now = new Date()) {
  const past = new Date(a.end) < now;
  if (a.viewerRole === 'host') {
    if (a.status === 'requested') return ['confirm', 'reschedule', 'decline'];
    if (a.status === 'confirmed') return [...(past ? ['complete'] : ['reschedule']), ...(past ? [] : ['cancel'])];
    if (a.status === 'rescheduled') return ['cancel'];
    return [];
  }
  if (a.status === 'rescheduled') return ['accept', 'cancel'];
  return ['requested', 'confirmed'].includes(a.status) ? ['cancel'] : [];
}
const BUTTONS = { confirm: ['Confirm', 'primary'], reschedule: ['Propose new time', 'outline'], decline: ['Decline', 'outline'], complete: ['Mark completed', 'primary'], accept: ['Accept new time', 'primary'], cancel: ['Cancel', 'ghost'] };

export default function Appointments() {
  usePageTitle('Viewings');
  const { user } = useAuth();
  const canHost = ['owner', 'agent', 'admin'].includes(user.role);
  const [params, setParams] = useSearchParams();
  const tab = canHost && params.get('tab') !== 'mine' ? 'received' : 'mine';
  const status = params.get('status') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = { page, limit: 15, ...(status && { status }) };
  const toast = useToast();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // { kind: 'decline' | 'cancel' | 'reschedule', appt }
  const [reason, setReason] = useState('');
  const [slot, setSlot] = useState({ date: '', time: '', duration: 30 });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['appointments', tab, query], queryFn: () => (tab === 'received' ? appointmentsApi.received(query) : appointmentsApi.mine(query)),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['appointments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const closeDialog = () => { setDialog(null); setReason(''); setSlot({ date: '', time: '', duration: 30 }); };

  const act = useMutation({
    mutationFn: ({ appt, body }) => (body.action === 'cancel' ? appointmentsApi.cancel(appt.id, body.reason) : appointmentsApi.act(appt.id, body)),
    onSuccess: () => { toast.success('Viewing updated.'); refresh(); closeDialog(); },
    onError: (e) => { toast.error(errorMessage(e)); closeDialog(); refresh(); },
  });
  const run = (appt, action) => {
    if (['decline', 'cancel', 'reschedule'].includes(action)) setDialog({ kind: action, appt });
    else act.mutate({ appt, body: { action } });
  };
  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setParams(n); };

  return (
    <div>
      <h1 className="text-3xl font-bold">Viewings</h1>
      <p className="mt-1 text-sm text-stone-500">All times are shown in Pakistan time.</p>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        {canHost ? (
          <div className="flex gap-2" role="tablist" aria-label="Viewing direction">
            {[['received', 'Requests for my listings'], ['mine', 'My requests']].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => update({ tab: id === 'received' ? '' : id, page: '', status: '' })}
                className={cn('rounded-full px-4 py-2 text-sm font-medium', tab === id ? 'bg-navy-900 text-white' : 'bg-white shadow-card hover:bg-stone-100')}>{label}</button>
            ))}
          </div>
        ) : <p className="text-sm text-stone-500">Viewings you have requested.</p>}
        <Select aria-label="Filter by status" value={status} onChange={(e) => update({ status: e.target.value, page: '' })} placeholder="All statuses" className="w-52" options={Object.entries(LABELS).map(([value, label]) => ({ value, label }))} />
      </div>

      <div className="mt-5 space-y-3">
        {isError ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />) :
          !data.appointments.length ? (
            <EmptyState icon={CalendarDays} title="No viewings here yet" description={tab === 'received' ? 'When someone asks to view one of your properties, it appears here.' : 'Open a property and choose “Request a viewing”.'} />
          ) : data.appointments.map((a) => (
            <article key={a.id} className="rounded-card bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <Avatar name={a.counterpart.name} url={a.counterpart.avatarUrl} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={TONES[a.status]}>{LABELS[a.status]}</Badge></div>
                    <p className="mt-1 font-semibold">{formatRange(a.start, a.end)}</p>
                    <p className="truncate text-sm text-stone-500"><Link to={`/properties/${a.property.slug}`} className="hover:underline">{a.property.title}</Link> · {a.viewerRole === 'host' ? a.counterpart.name : `with ${a.counterpart.name}`}</p>
                    {a.viewerRole === 'host' && (a.counterpart.email || a.counterpart.phone) && (
                      <ul className="mt-1 flex flex-wrap gap-x-4 text-sm text-stone-700">
                        {a.counterpart.phone && <li className="flex items-center gap-1"><Phone className="h-4 w-4" aria-hidden="true" /><a href={`tel:${a.counterpart.phone}`} className="hover:underline">{a.counterpart.phone}</a></li>}
                        {a.counterpart.email && <li className="flex items-center gap-1"><Mail className="h-4 w-4" aria-hidden="true" /><a href={`mailto:${a.counterpart.email}`} className="hover:underline">{a.counterpart.email}</a></li>}
                      </ul>
                    )}
                    {a.message && <p className="mt-1 text-sm italic text-stone-600">“{a.message}”</p>}
                    {a.declineReason && <p className="mt-1 text-sm text-stone-600">Note: {a.declineReason}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {actionsFor(a).map((k) => <Button key={k} size="sm" variant={BUTTONS[k][1]} disabled={act.isPending} onClick={() => run(a, k)}>{BUTTONS[k][0]}</Button>)}
                </div>
              </div>
            </article>
          ))}
      </div>
      <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />

      <ConfirmDialog open={dialog?.kind === 'decline' || dialog?.kind === 'cancel'} onClose={closeDialog} loading={act.isPending} danger
        title={dialog?.kind === 'decline' ? 'Decline this request?' : 'Cancel this viewing?'} confirmLabel={dialog?.kind === 'decline' ? 'Decline' : 'Cancel viewing'}
        message={dialog?.kind === 'decline' ? 'The requester will see that you declined.' : 'The other person will see that it was cancelled.'}
        onConfirm={() => act.mutate({ appt: dialog.appt, body: { action: dialog.kind === 'decline' ? 'decline' : 'cancel', ...(reason.trim() && { reason: reason.trim() }) } })}>
        <div className="mt-4"><Textarea label="Add a note (optional)" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </ConfirmDialog>

      <Modal open={dialog?.kind === 'reschedule'} onClose={closeDialog} title="Propose a new time" sheet>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (slot.date && slot.time) act.mutate({ appt: dialog.appt, body: { action: 'reschedule', start: pktToIso(slot.date, slot.time), durationMinutes: slot.duration } }); }}>
          <p className="text-sm text-stone-500">The requester will be asked to accept the new time.</p>
          <SlotPicker value={slot} onChange={setSlot} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="submit" loading={act.isPending} disabled={!slot.date || !slot.time}>Send proposal</Button></div>
        </form>
      </Modal>
    </div>
  );
}
