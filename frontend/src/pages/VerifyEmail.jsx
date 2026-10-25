import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import AuthShell from '../components/auth/AuthShell';
import Button from '../components/common/Button';
import { authApi } from '../services/auth';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { isAuthenticated, refreshUser } = useAuth();
  const [state, setState] = useState(token ? 'working' : 'missing'); // working | done | failed | missing
  const [message, setMessage] = useState('');
  const ran = useRef(false); // the token is single-use; StrictMode must not spend it twice

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    authApi.verifyEmail(token)
      .then(async () => { setState('done'); if (isAuthenticated) await refreshUser().catch(() => {}); })
      .catch((err) => { setState('failed'); setMessage(err.message); });
  }, [token, isAuthenticated, refreshUser]);

  return (
    <AuthShell title="Email verification">
      <div role="status" className="flex flex-col items-center gap-3 text-center text-sm">
        {state === 'working' && (<><Loader2 className="h-8 w-8 animate-spin text-sage-600" aria-hidden="true" /><p>Verifying your email…</p></>)}
        {state === 'done' && (<><CheckCircle2 className="h-8 w-8 text-sage-600" aria-hidden="true" /><p>Your email is verified.</p><Button as={Link} to="/dashboard">Go to dashboard</Button></>)}
        {state === 'failed' && (<><XCircle className="h-8 w-8 text-red-700" aria-hidden="true" /><p>{message}</p><Button as={Link} to="/dashboard" variant="outline">Resend from your dashboard</Button></>)}
        {state === 'missing' && (<><XCircle className="h-8 w-8 text-red-700" aria-hidden="true" /><p>This link is incomplete. Open the link from your email.</p></>)}
      </div>
    </AuthShell>
  );
}
