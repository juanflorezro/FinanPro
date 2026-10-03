import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAppAuth } from './AppAuth.jsx';
import { Loading } from '../components/ui.jsx';
import { MEMBER_ROLES } from '../utils/labels.js';

const icon = (d) => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const NAV = [
  { to: '/', end: true, label: 'Inicio', icon: icon('M3 10.5L10 4l7 6.5M5 9v7h4v-4h2v4h4V9'), perm: 'loan.read' },
  { to: '/prestamos', label: 'Préstamos', icon: icon('M3 6h14v9H3zM3 9h14M6 12.5h3'), perm: 'loan.read' },
  { to: '/deudores', label: 'Deudores', icon: icon('M4 16.5v-1A3.5 3.5 0 017.5 12h5a3.5 3.5 0 013.5 3.5v1M10 9.5a3 3 0 100-6 3 3 0 000 6z'), perm: 'borrower.read' },
  { to: '/pagos', label: 'Pagos', icon: icon('M10 3v14M13.5 6.5c0-1.4-1.6-2.5-3.5-2.5S6.5 5.1 6.5 6.5 8 8.6 10 9s3.5 1.3 3.5 3-1.6 2.5-3.5 2.5-3.5-1.1-3.5-2.5'), perm: 'payment.read' },
  { to: '/cajas', label: 'Cajas', icon: icon('M3 7h14v9H3zM6 7V5h8v2M10 10.5v2'), perm: 'cash.read' },
  { to: '/equipo', label: 'Equipo', icon: icon('M7 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM13.5 9a2 2 0 100-4M2.5 16v-.5A3.5 3.5 0 016 12h2a3.5 3.5 0 013.5 3.5v.5M14 12h.5a3 3 0 013 3v1'), perm: 'member.read' },
  { to: '/configuracion', label: 'Configuración', icon: icon('M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4') },
];

const STATUS_BANNER = {
  solo_lectura: 'Tu empresa está en solo lectura. Puedes consultar y exportar, pero no crear préstamos ni registrar pagos. Ponte al día con el pago de FinanPro para reactivarla.',
  suspendida: 'Tu empresa está suspendida. Comunícate con FinanPro.',
};

export default function AppLayout() {
  const { me, org, ready, logout, switchOrg, can } = useAppAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!ready) return <div className="boot"><Loading label="Abriendo FinanPro" /></div>;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!org) return <Navigate to="/crear-organizacion" replace />;

  const user = me.user;
  const initials = (user.name ?? user.email).split(/[ @]/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
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
          {NAV.filter((n) => !n.perm || can(n.perm)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenuOpen(false)}>{n.icon}<span>{n.label}</span></NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div className="sidebar-user-text">
            <strong>{user.name ?? user.email}</strong>
            <span>{MEMBER_ROLES[org.role]}</span>
          </div>
          <button type="button" className="icon-btn on-dark" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M8 4H5v12h3M12 7l3 3-3 3M15 10H8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </aside>

      <div className="topbar-mobile">
        <button type="button" className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Abrir menú" aria-expanded={menuOpen}>
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <span className="logo-word">{org.name}</span>
      </div>
      <button type="button" className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} tabIndex={-1} />

      <main className="content">
        {STATUS_BANNER[org.status] && <div className="org-banner" role="status">{STATUS_BANNER[org.status]}</div>}
        <Outlet />
      </main>
    </div>
  );
}
