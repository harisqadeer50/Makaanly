import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { inquiriesApi } from '../../services/marketplace';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { Textarea } from '../../components/common/FormFields';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { timeAgo } from '../../utils/datetime';
import { cn } from '../../utils/cn';
import { INQUIRY_LABELS, INQUIRY_TONES } from './Inquiries';

function Bubble({ mine, who, message, at }) {
  return (
    <li className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div className={cn('max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm', mine ? 'bg-navy-900 text-white' : 'bg-white shadow-card')}>{message}</div>
      <span className="mt-1 text-xs text-stone-500">{who} · {timeAgo(at)}</span>
    </li>
  );
}

export default function InquiryThread() {
  const { id } = useParams();
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [closing, setClosing] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['inquiry', id], queryFn: () => inquiriesApi.get(id), retry: false });
  const inquiry = data?.inquiry;
  usePageTitle(inquiry ? `Inquiry: ${inquiry.property.title}` : 'Inquiry');

  const done = (r) => { qc.setQueryData(['inquiry', id], r); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const reply = useMutation({ mutationFn: () => inquiriesApi.reply(id, text.trim()), onSuccess: (r) => { done(r); setText(''); }, onError: (e) => toast.error(errorMessage(e)) });
  const close = useMutation({ mutationFn: () => inquiriesApi.setStatus(id, 'closed'), onSuccess: (r) => { done(r); setClosing(false); toast.success('Conversation closed.'); }, onError: (e) => { toast.error(errorMessage(e)); setClosing(false); } });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (isError) {
    return error.status === 404
      ? <EmptyState title="Conversation not found" description="It may belong to another account." action={<Button as={Link} to="/dashboard/inquiries">Back to inquiries</Button>} />
      : <ErrorState message={error.message} onRetry={refetch} />;
  }
  const asRecipient = inquiry.viewerRole === 'recipient';
  const c = inquiry.counterpart;

  return (
    <div className="max-w-3xl">
      <Link to={`/dashboard/inquiries${asRecipient ? '' : '?tab=sent'}`} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-navy-900"><ArrowLeft className="h-4 w-4" aria-hidden="true" />All inquiries</Link>
      <div className="rounded-card bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={c.name} url={c.avatarUrl} size="h-12 w-12 text-lg" />
            <div><h1 className="font-sans text-xl font-semibold">{c.name}</h1><p className="text-sm text-stone-500">{asRecipient ? 'Interested buyer' : c.role === 'agent' ? 'Real estate agent' : 'Property owner'}</p></div>
          </div>
          <Badge tone={INQUIRY_TONES[inquiry.status]}>{INQUIRY_LABELS[inquiry.status]}</Badge>
        </div>
        <p className="mt-4 text-sm">About <Link to={`/properties/${inquiry.property.slug}`} className="font-medium text-sage-600 hover:underline">{inquiry.property.title}</Link></p>
        {asRecipient && (
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-700">
            {c.email && <li className="flex items-center gap-1.5"><Mail className="h-4 w-4" aria-hidden="true" /><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></li>}
            {inquiry.phone && <li className="flex items-center gap-1.5"><Phone className="h-4 w-4" aria-hidden="true" /><a href={`tel:${inquiry.phone}`} className="hover:underline">{inquiry.phone}</a></li>}
          </ul>
        )}
      </div>

      <ol className="mt-6 space-y-4" aria-label="Messages">
        <Bubble mine={!asRecipient} who={asRecipient ? c.name : 'You'} message={inquiry.message} at={inquiry.createdAt} />
        {inquiry.replies.map((r) => <Bubble key={r.id} mine={r.mine} who={r.mine ? 'You' : c.name} message={r.message} at={r.createdAt} />)}
      </ol>

      {inquiry.status === 'closed' ? (
        <p role="status" className="mt-6 rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700">This conversation is closed.{!asRecipient && <> You can <Link to={`/properties/${inquiry.property.slug}`} className="font-medium underline">send a new inquiry</Link> from the listing.</>}</p>
      ) : (
        <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) reply.mutate(); }}>
          <Textarea label="Your reply" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setClosing(true)}>Close conversation</Button>
            <Button type="submit" loading={reply.isPending} disabled={!text.trim()}>Send reply</Button>
          </div>
        </form>
      )}
      <ConfirmDialog open={closing} onClose={() => setClosing(false)} onConfirm={() => close.mutate()} loading={close.isPending} title="Close this conversation?" confirmLabel="Close conversation"
        message="Neither of you will be able to add messages. The buyer can start a new inquiry from the listing." />
    </div>
  );
}
