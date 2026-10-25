import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | guest
  const queryClient = useQueryClient();

  const apply = useCallback((u) => { setUser(u); setStatus(u ? 'authenticated' : 'guest'); }, []);

  useEffect(() => {
    let alive = true;
    authApi.me().then((d) => alive && apply(d.user)).catch(() => alive && apply(null));
    return () => { alive = false; };
  }, [apply]);

  // The API client fires this when a silent refresh fails (session expired or revoked).
  useEffect(() => {
    const onExpired = () => { queryClient.clear(); apply(null); };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [apply, queryClient]);

  const value = useMemo(() => ({
    user, status,
    isAuthenticated: status === 'authenticated',
    login: async (body) => { const d = await authApi.login(body); apply(d.user); return d.user; },
    register: async (body) => { const d = await authApi.register(body); apply(d.user); return d.user; },
    logout: async () => { try { await authApi.logout(); } finally { queryClient.clear(); apply(null); } },
    refreshUser: async () => { const d = await authApi.me(); apply(d.user); return d.user; },
    setUser: apply,
  }), [user, status, apply, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
