import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { portalApi, getPortalToken, setPortalToken } from '../api/portalClient.js';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { PortalContext } from './PortalLayout.jsx';

const KEY = '__global';

/** Portal global del deudor: una sola entrada para ver lo que debe en todas las empresas. */
export default function GlobalPortalLayout() {
  const navigate = useNavigate();
  const [token, setToken] = useState(getPortalToken(KEY));
  useEffect(() => { document.title = 'Mis préstamos | FinanPro'; }, []);

  const signIn = useCallback((t) => { setPortalToken(KEY, t); setToken(t); }, []);
  const signOut = useCallback((reason) => {
    setPortalToken(KEY, null);
    setToken(null);
    navigate('/portal', { replace: true, state: reason ? { reason } : undefined });
  }, [navigate]);
  const call = useCallback(async (path) => {
    try { return await portalApi(null, path); } catch (e) {
      if (e.status === 401) signOut('Tu sesión terminó por seguridad. Ingresa de nuevo.');
      throw e;
    }
  }, [signOut]);

  const ctx = {
    slug: null, company: { name: 'FinanPro' }, token, signIn, signOut, call,
    basePath: '/portal', loanPath: (id, orgId) => `/loans/${orgId}/${id}`,
  };

  return (
    <PortalContext.Provider value={ctx}>
      <div className="portal">
        <header className="portal-header">
          <Link to={token ? '/portal/inicio' : '/portal'} className="portal-brand">
            <span className="portal-mark" aria-hidden="true">F</span>
            <span><strong>FinanPro</strong><small>Todos tus préstamos en un lugar</small></span>
          </Link>
          {token && <button type="button" className="portal-out" onClick={() => signOut()}>Salir</button>}
        </header>
        <main className="portal-main">
          <ErrorBoundary resetKey={token}><Outlet /></ErrorBoundary>
        </main>
        <footer className="portal-footer">
          <span>Solo consulta. Para pagos o acuerdos, comunícate con cada empresa.</span>
          <span>La sesión se cierra sola a los 30 minutos.</span>
        </footer>
      </div>
    </PortalContext.Provider>
  );
}
