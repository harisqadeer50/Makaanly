import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Clock, FileText, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { verificationApi } from '../../services/admin';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import { Textarea } from '../../components/common/FormFields';
import { FormError } from '../../components/auth/AuthShell';
import { useToast } from '../../components/common/Toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../utils/applyServerErrors';
import { formatDay } from '../../utils/datetime';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX = 3; const MAX_BYTES = 5 * 1024 * 1024;

export default function Verification() {
  usePageTitle('Verification');
  const { user, refreshUser } = useAuth();
  const toast = useToast(); const qc = useQueryClient();
  const input = useRef(null);
  const [files, setFiles] = useState([]); const [message, setMessage] = useState('');
  const [fileErrors, setFileErrors] = useState([]); const [formError, setFormError] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['verification'], queryFn: verificationApi.me });

  const add = (list) => {
    const errs = []; const next = [...files];
    [...list].forEach((f) => {
      if (!TYPES.includes(f.type)) errs.push(`${f.name}: only JPEG, PNG, WebP or PDF files are allowed.`);
      else if (f.size > MAX_BYTES) errs.push(`${f.name} is larger than 5 MB.`);
      else if (f.size === 0) errs.push(`${f.name} is empty.`);
      else if (next.length >= MAX) errs.push(`You can attach up to ${MAX} files. Skipped ${f.name}.`);
      else next.push(f);
    });
    setFiles(next); setFileErrors(errs);
  };
  const submit = useMutation({
    mutationFn: () => verificationApi.submit(message.trim(), files),
    onSuccess: () => { toast.success('Your request was sent. We will review it soon.'); setFiles([]); setMessage(''); qc.invalidateQueries({ queryKey: ['verification'] }); refreshUser().catch(() => {}); },
    onError: (e) => { setFormError(errorMessage(e)); qc.invalidateQueries({ queryKey: ['verification'] }); },
  });
  const onSubmit = (e) => { e.preventDefault(); setFormError(null); if (!files.length) { setFormError('Attach at least one document.'); return; } submit.mutate(); };

  if (isLoading) return <Skeleton className="h-64 max-w-2xl" />;
  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;
  const { verificationStatus: status, request } = data;
  const isAgent = user.role === 'agent';

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">Get verified</h1>
      <p className="mt-1 text-sm text-stone-500">Verified {isAgent ? 'agents' : 'owners'} get a badge on their profile and listings, which helps buyers trust them.</p>

      {status === 'verified' && (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-card border border-sage-200 bg-sage-50 p-5 text-sage-700"><BadgeCheck className="h-6 w-6 shrink-0" aria-hidden="true" /><div><p className="font-semibold">You are verified</p><p className="text-sm">The verified badge now shows on your profile and listings.</p></div></div>
      )}
      {status === 'pending' && (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-5 text-amber-900"><Clock className="h-6 w-6 shrink-0" aria-hidden="true" />
          <div><p className="font-semibold">Your request is under review</p><p className="text-sm">Sent {request?.submittedAt ? formatDay(request.submittedAt) : ''}{request ? ` with ${request.documentCount} document${request.documentCount === 1 ? '' : 's'}` : ''}. We will email you when there is a decision.</p></div></div>
      )}
      {['none', 'rejected'].includes(status) && (
        <>
          {request && ['rejected', 'revoked'].includes(request.status) && (
            <div role="note" className="mt-6 flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-5 text-red-900"><ShieldAlert className="h-6 w-6 shrink-0" aria-hidden="true" />
              <div><p className="font-semibold">{request.status === 'revoked' ? 'Your verified status was removed' : 'Your last request was not approved'}</p>{request.rejectionReason && <p className="text-sm">Reason: {request.rejectionReason}</p>}<p className="mt-1 text-sm">You can apply again below.</p></div></div>
          )}
          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5 rounded-card bg-white p-5 shadow-card sm:p-7">
            <FormError message={formError} />
            <div>
              <p className="text-sm font-medium text-navy-800">Documents</p>
              <p className="mt-1 text-sm text-stone-500">{isAgent ? 'A photo of your national ID and your agency licence or business card.' : 'A photo of your national ID and proof of ownership, such as a title deed or utility bill.'} JPEG, PNG, WebP or PDF, up to 5 MB each, at most {MAX} files. They are stored privately, seen only by our review team, and deleted once we decide.</p>
              <Button type="button" variant="outline" className="mt-3" disabled={files.length >= MAX} onClick={() => input.current?.click()}><Upload className="h-4 w-4" aria-hidden="true" />Choose files</Button>
              <input ref={input} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" className="sr-only" aria-label="Upload verification documents" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
              {fileErrors.length > 0 && <ul role="alert" className="mt-3 space-y-1 text-sm text-red-700">{fileErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
              {files.length > 0 && (
                <ul className="mt-3 space-y-2" aria-label="Selected files">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"><FileText className="h-4 w-4 shrink-0 text-stone-500" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-stone-500">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-md text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></li>
                  ))}
                </ul>
              )}
            </div>
            <Textarea label="Note for the reviewer (optional)" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button type="submit" loading={submit.isPending}>Send for review</Button>
          </form>
        </>
      )}
    </div>
  );
}
