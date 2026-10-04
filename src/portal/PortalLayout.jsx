import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { portalApi, getPortalToken, setPortalToken } from '../api/portalClient.js';
import { Loading } from '../components/ui.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';

export const PortalContext = createContext(null);
export const usePortal = () => useContext(PortalContext);

export default function PortalLayout() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(getPortalToken(slug));

  useEffect(() => {
    document.title = 'Consulta tus préstamos';
    portalApi(slug).then((c) => { setCompany(c); document.title = `${c.name} | Consulta tus préstamos`; }).catch(setError);
  }, [slug]);

  const signIn = useCallback((t) => { setPortalToken(slug, t); setToken(t); }, [slug]);
  const signOut = useCallback((reason) => {
    setPortalToken(slug, null);
    setToken(null);
    navigate(`/p/${slug}`, { replace: true, state: reason ? { reason } : undefined });
  }, [slug, navigate]);

  /** Llama la API del portal; si la sesión venció, vuelve a la entrada. */
  const call = useCallback(async (path) => {
    try { return await portalApi(slug, path); } catch (e) {
      if (e.status === 401) signOut('Tu sesión terminó por seguridad. Ingresa de nuevo.');
      throw e;
    }
  }, [slug, signOut]);

  if (error) {
    return (
      <div className="portal portal-center">
        <div className="portal-card portal-narrow">
          <h1>Portal no disponible</h1>
          <p className="muted">{error.message}. Revisa el enlace que te compartió la empresa.</p>
        </div>
      </div>
    );
  }
  if (!company) return <div className="portal portal-center"><Loading /></div>;

  const initials = company.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <PortalContext.Provider value={{ slug, company, token, signIn, signOut, call, basePath: `/p/${slug}`, loanPath: (id) => `/loans/${id}` }}>
      <div className="portal">
        <header className="portal-header">
          <Link to={token ? `/p/${slug}/inicio` : `/p/${slug}`} className="portal-brand">
            {company.logoUrl ? <img src={company.logoUrl} alt="" /> : <span className="portal-mark" aria-hidden="true">{initials}</span>}
            <span><strong>{company.name}</strong><small>Consulta de préstamos</small></span>
          </Link>
          {token && <button type="button" className="portal-out" onClick={() => signOut()}>Salir</button>}
        </header>
        <main className="portal-main">
          <ErrorBoundary resetKey={token}><Outlet /></ErrorBoundary>
        </main>
        <footer className="portal-footer">
          <span>Tus datos están protegidos. La sesión se cierra sola a los 30 minutos.</span>
          <span>Con tecnología de <strong>FinanPro</strong></span>
        </footer>
      </div>
    </PortalContext.Provider>
  );
}
