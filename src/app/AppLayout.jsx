import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppAuth } from './AppAuth.jsx';
import { appApi } from '../api/appClient.js';
import { Loading } from '../components/ui.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { MEMBER_ROLES } from '../utils/labels.js';

const icon = (d, size = 18) => (
  <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const P = {
  home: 'M3 10.5L10 4l7 6.5M5 9v7h4v-4h2v4h4V9',
  loans: 'M3 6h14v9H3zM3 9h14M6 12.5h3',
  people: 'M4 16.5v-1A3.5 3.5 0 017.5 12h5a3.5 3.5 0 013.5 3.5v1M10 9.5a3 3 0 100-6 3 3 0 000 6z',
  pay: 'M10 3v14M13.5 6.5c0-1.4-1.6-2.5-3.5-2.5S6.5 5.1 6.5 6.5 8 8.6 10 9s3.5 1.3 3.5 3-1.6 2.5-3.5 2.5-3.5-1.1-3.5-2.5',
  cash: 'M3 7h14v9H3zM6 7V5h8v2M10 10.5v2',
  team: 'M7 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM13.5 9a2 2 0 100-4M2.5 16v-.5A3.5 3.5 0 016 12h2a3.5 3.5 0 013.5 3.5v.5M14 12h.5a3 3 0 013 3v1',
  help: 'M4 4h12v9H8l-4 3.5zM7.5 7.5h5M7.5 10h3',
  gear: 'M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4',
  more: 'M4.5 10h.01M10 10h.01M15.5 10h.01',
  logout: 'M8 4H5v12h3M12 7l3 3-3 3M15 10H8',
};

const NAV = [
  { to: '/', end: true, label: 'Inicio', icon: P.home, perm: 'loan.read', tab: true },
  { to: '/prestamos', label: 'Préstamos', icon: P.loans, perm: 'loan.read', tab: true },
  { to: '/deudores', label: 'Deudores', icon: P.people, perm: 'borrower.read', tab: true },
  { to: '/pagos', label: 'Pagos', icon: P.pay, perm: 'payment.read', tab: true },
  { to: '/cajas', label: 'Cajas', icon: P.cash, perm: 'cash.read' },
  { to: '/equipo', label: 'Equipo', icon: P.team, perm: 'member.read' },
  { to: '/soporte', label: 'Soporte', icon: P.help, badge: 'support' },
  { to: '/configuracion', label: 'Configuración', icon: P.gear },
];

const STATUS_BANNER = {
  solo_lectura: 'Tu empresa está en solo lectura. Puedes consultar y exportar, pero no crear préstamos ni registrar pagos. Ponte al día con el pago de FinanPro para reactivarla.',
  suspendida: 'Tu empresa está suspendida. Escríbenos desde Soporte.',
};

/** En el celular las tablas se ven como tarjetas: copia el título de cada columna a sus celdas. */
function useCardTables(ref, key) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const label = () => {
      root.querySelectorAll('table.table').forEach((table) => {
        const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
        table.querySelectorAll('tbody tr').forEach((tr) => {
          [...tr.children].forEach((td, i) => { if (heads[i] !== undefined && td.dataset.label !== heads[i]) td.dataset.label = heads[i]; });
        });
      });
    };
    label();
    const obs = new MutationObserver(label);
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [ref, key]);
}

export default function AppLayout() {
  const { me, org, ready, logout, switchOrg, can } = useAppAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const contentRef = useRef(null);
  useCardTables(contentRef, org?.id);

  // Al cambiar de pantalla, volver arriba (si no, una pantalla corta se ve "en blanco")
  useEffect(() => { setMoreOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (!org) return undefined;
    const load = () => appApi('/support/unread').then((r) => setUnread(r.unread)).catch(() => {});
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30_000);
    return () => clearInterval(t);
  }, [org, location.pathname]);

  if (!ready) return <div className="boot"><Loading label="Abriendo FinanPro" /></div>;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!org) return <Navigate to="/crear-organizacion" replace />;

  const user = me.user;
  const initials = (user.name ?? user.email).split(/[ @]/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const items = NAV.filter((n) => !n.perm || can(n.perm));
  const tabs = items.filter((n) => n.tab).slice(0, 4);
  const rest = items.filter((n) => !tabs.includes(n));
  const badge = (n) => (n.badge === 'support' && unread > 0 ? <span className="nav-badge" aria-label={`${unread} sin leer`}>{unread > 9 ? '9+' : unread}</span> : null);
  const restActive = rest.some((n) => location.pathname.startsWith(n.to));

  return (
    <div className="shell app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark" aria-hidden="true">F</span>
          <span className="logo-word">FinanPro</span>
        </div>
        {me.organizations.length > 1 ? (
          <select className="org-switch" value={org.id} onChange={(e) => { switchOrg(e.target.value); window.location.assign('/'); }} aria-label="Empresa">
            {me.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        ) : <p className="org-name">{org.name}</p>}
        <nav className="sidebar-nav" aria-label="Secciones">
          {items.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{icon(n.icon)}<span>{n.label}</span>{badge(n)}</NavLink>)}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div className="sidebar-user-text"><strong>{user.name ?? user.email}</strong><span>{MEMBER_ROLES[org.role]}</span></div>
          <button type="button" className="icon-btn on-dark" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">{icon(P.logout)}</button>
        </div>
      </aside>

      {/* ---------- Barra superior (solo celular) ---------- */}
      <header className="m-topbar">
        <span className="logo-mark" aria-hidden="true">F</span>
        <div className="m-topbar-title">
          <strong>{org.name}</strong>
          <span>{MEMBER_ROLES[org.role]}</span>
        </div>
        <NavLink to="/soporte" className="m-topbar-btn" aria-label="Soporte">{icon(P.help, 22)}{badge({ badge: 'support' })}</NavLink>
      </header>

      <main className="content" ref={contentRef}>
        {STATUS_BANNER[org.status] && <div className="org-banner" role="status">{STATUS_BANNER[org.status]}</div>}
        <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
      </main>

      {/* ---------- Pestañas inferiores (solo celular) ---------- */}
      <nav className="m-tabbar" aria-label="Secciones principales">
        {tabs.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{icon(n.icon, 22)}<span>{n.label}</span></NavLink>)}
        <button type="button" className={restActive || moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}>
          {icon(P.more, 22)}<span>Más</span>{unread > 0 && <span className="nav-dot" />}
        </button>
      </nav>

      {moreOpen && (
        <div className="m-sheet-wrap" role="dialog" aria-modal="true" aria-label="Más opciones">
          <button type="button" className="m-sheet-scrim" aria-label="Cerrar" onClick={() => setMoreOpen(false)} />
          <div className="m-sheet">
            <span className="m-sheet-grip" aria-hidden="true" />
            <div className="m-sheet-user">
              <span className="avatar" aria-hidden="true">{initials}</span>
              <div><strong>{user.name ?? user.email}</strong><span className="muted small">{user.email}</span></div>
            </div>
            {me.organizations.length > 1 && (
              <select className="input" value={org.id} onChange={(e) => { switchOrg(e.target.value); window.location.assign('/'); }} aria-label="Cambiar de empresa">
                {me.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            <nav className="m-sheet-nav">
              {rest.map((n) => <NavLink key={n.to} to={n.to}>{icon(n.icon, 20)}<span>{n.label}</span>{badge(n)}</NavLink>)}
              <button type="button" onClick={logout}>{icon(P.logout, 20)}<span>Cerrar sesión</span></button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
