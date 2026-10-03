import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appApi, setAppToken, refreshAppSession, onAppSessionExpired, getOrgId, setOrgId } from '../api/appClient.js';
import { hasPermission } from '../utils/permissions.js';

const AppAuthContext = createContext(null);

export function AppAuthProvider({ children }) {
  const [me, setMe] = useState(null);       // { user, organizations, canCreateOrg }
  const [orgId, setOrg] = useState(getOrgId());
  const [ready, setReady] = useState(false);

  const loadMe = useCallback(async () => {
    const data = await appApi('/auth/me');
    setMe(data);
    const ids = data.organizations.map((o) => String(o.id));
    const preferred = [getOrgId(), data.user.defaultOrgId].find((id) => id && ids.includes(String(id))) ?? ids[0] ?? null;
    setOrgId(preferred);
    setOrg(preferred);
    return data;
  }, []);

  useEffect(() => {
    onAppSessionExpired(() => setMe(null));
    refreshAppSession()
      .then(loadMe)
      .catch(() => setMe(null))
      .finally(() => setReady(true));
  }, [loadMe]);

  /** Guarda la sesión que devuelve el backend y carga las organizaciones. */
  const acceptSession = useCallback(async ({ accessToken }) => {
    setAppToken(accessToken);
    return loadMe();
  }, [loadMe]);

  const logout = useCallback(async () => {
    try { await appApi('/auth/logout', { method: 'POST' }); } catch { /* igual cerramos */ }
    setAppToken(null);
    setMe(null);
  }, []);

  const switchOrg = useCallback((id) => { setOrgId(id); setOrg(id); }, []);

  const org = me?.organizations.find((o) => String(o.id) === String(orgId)) ?? null;
  const can = useCallback((perm) => hasPermission(org?.role, perm), [org]);

  const value = useMemo(() => ({ me, user: me?.user, org, ready, loadMe, acceptSession, logout, switchOrg, can }),
    [me, org, ready, loadMe, acceptSession, logout, switchOrg, can]);
  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export const useAppAuth = () => useContext(AppAuthContext);
