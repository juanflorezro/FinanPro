import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken, onAdminSession, refreshAdminSession } from '../api/client.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onAdminSession(setAdmin);
    // Recupera la sesión con la cookie de renovación, si existe
    refreshAdminSession().catch(() => setAdmin(null)).finally(() => setReady(true));
  }, []);

  const startLogin = useCallback((email, password) =>
    api('/admin/auth/login', { method: 'POST', body: { email, password } }), []);

  const verifyLogin = useCallback(async (mfaToken, code, method = 'totp') => {
    const data = await api('/admin/auth/login/verify', { method: 'POST', body: { mfaToken, code, method } });
    setAccessToken(data.accessToken);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const logout = useCallback(async () => {
    try { await api('/admin/auth/logout', { method: 'POST' }); } catch { /* sin conexión: cerramos igual */ }
    setAccessToken(null);
    setAdmin(null);
  }, []);

  const can = useCallback((...roles) => admin?.role === 'superadmin' || roles.includes(admin?.role), [admin]);

  const value = useMemo(() => ({ admin, ready, startLogin, verifyLogin, logout, can }), [admin, ready, startLogin, verifyLogin, logout, can]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export const useAdminAuth = () => useContext(AdminAuthContext);
