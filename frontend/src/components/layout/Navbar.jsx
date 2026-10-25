import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../common/Logo';
import Button from '../common/Button';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import AccountMenu from './AccountMenu';
import NotificationBell from './NotificationBell';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/properties?purpose=sale', label: 'Buy' },
  { to: '/properties?purpose=rent', label: 'Rent' },
  { to: '/properties?type=commercial,office,shop', label: 'Commercial' },
  { to: '/agents', label: 'Agents' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const closeRef = useRef(null);
  const { status, isAuthenticated, user, logout } = useAuth();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  const linkClass = ({ isActive }) =>
    cn('rounded-md px-3 py-2 text-sm font-medium transition-colors', isActive ? 'text-sage-600' : 'text-navy-800 hover:text-sage-600');

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => <NavLink key={l.label} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button as={Link} to="/dashboard/properties/new" variant="accent" size="sm">List your property</Button>
          {isAuthenticated ? <><NotificationBell /><AccountMenu /></> : status === 'guest' && (<>
            <Button as={Link} to="/login" variant="ghost" size="sm">Log in</Button>
            <Button as={Link} to="/register" variant="primary" size="sm">Register</Button>
          </>)}
        </div>
        <div className="flex items-center gap-1 lg:hidden">
        {isAuthenticated && <NotificationBell />}
        <button type="button" className="grid h-11 w-11 place-items-center rounded-lg" aria-label="Open menu" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-navy-900/50" onClick={() => setOpen(false)} />
          <div id="mobile-nav" className="absolute right-0 top-0 flex h-full w-[min(20rem,85vw)] flex-col bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button ref={closeRef} type="button" className="grid h-11 w-11 place-items-center rounded-lg" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex flex-col">
              {links.map((l) => <NavLink key={l.label} to={l.to} end={l.end} className={(s) => cn(linkClass(s), 'py-3 text-base')}>{l.label}</NavLink>)}
            </nav>
            <div className="mt-auto grid gap-2">
              <Button as={Link} to="/dashboard/properties/new" variant="accent">List your property</Button>
              {isAuthenticated ? (<>
                <Button as={Link} to="/dashboard" variant="outline">Dashboard ({user.name.split(' ')[0]})</Button>
                <Button variant="ghost" onClick={() => logout()}>Log out</Button>
              </>) : (<>
                <Button as={Link} to="/login" variant="outline">Log in</Button>
                <Button as={Link} to="/register">Register</Button>
              </>)}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
