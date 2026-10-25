import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

export default function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const signOut = async () => {
    setOpen(false);
    await logout().catch(() => {});
    toast.success('You have been logged out.');
    navigate('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-lg px-2 hover:bg-stone-100">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-900 text-sm font-semibold text-white" aria-hidden="true">{user.name[0].toUpperCase()}</span>
        <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:block">{user.name.split(' ')[0]}</span>
        <ChevronDown className="h-4 w-4 text-stone-500" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 rounded-card border border-stone-200 bg-white p-1.5 shadow-card">
          <div className="border-b border-stone-100 px-3 py-2"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-stone-500">{user.email}</p></div>
          <Link role="menuitem" to="/dashboard" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-stone-100"><LayoutDashboard className="h-4 w-4" aria-hidden="true" />Dashboard</Link>
          {user.role === 'admin' && <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-stone-100"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Admin panel</Link>}
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-stone-100"><LogOut className="h-4 w-4" aria-hidden="true" />Log out</button>
        </div>
      )}
    </div>
  );
}
