import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAdminAuth } from '../auth/AdminAuth.jsx';
import { ADMIN_ROLES } from '../utils/labels.js';
import { Loading } from '../components/ui.jsx';

const icon = (d) => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const NAV = [
  { to: '/admin', end: true, label: 'Resumen', icon: icon('M3 10.5L10 4l7 6.5M5 9v7h4v-4h2v4h4V9') },
  { to: '/admin/clientes', label: 'Clientes', icon: icon('M4 16.5v-1A3.5 3.5 0 017.5 12h5a3.5 3.5 0 013.5 3.5v1M10 9.5a3 3 0 100-6 3 3 0 000 6z') },
  { to: '/admin/organizaciones', label: 'Organizaciones', icon: icon('M3 17h14M5 17V7l5-3 5 3v10M8 10h1M11 10h1M8 13h1M11 13h1') },
  { to: '/admin/planes', label: 'Planes', icon: icon('M4 5h12v4H4zM4 11h12v4H4z') },
  { to: '/admin/tasas', label: 'Tasas legales', icon: icon('M5 15L15 5M6.5 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM13.5 15a1.5 1.5 0 100-3 1.5 1.5 0 000 3z'), roles: ['finanzas', 'soporte'] },
  { to: '/admin/bitacora', label: 'Bitácora', icon: icon('M6 3h8l2 2v12H4V5zM7 8h6M7 11h6M7 14h4'), roles: ['soporte'] },
  { to: '/admin/administradores', label: 'Administradores', icon: icon('M10 3l6 2.5v4.2c0 3.6-2.6 6.4-6 7.3-3.4-.9-6-3.7-6-7.3V5.5z'), roles: [] },
];

export default function AdminLayout() {
  const { admin, ready, logout, can } = useAdminAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!ready) return <div className="boot"><Loading label="Abriendo el panel" /></div>;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  const initials = admin.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark" aria-hidden="true">F</span>
          <span className="logo-word">FinanPro</span>
          <span className="sidebar-tag">Plataforma</span>
        </div>
        <nav className="sidebar-nav" aria-label="Secciones">
          {NAV.filter((n) => !n.roles || can(...n.roles)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenuOpen(false)}>
              {n.icon}<span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div className="sidebar-user-text">
            <strong>{admin.name}</strong>
            <span>{ADMIN_ROLES[admin.role]}</span>
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
        <span className="logo-word">FinanPro</span>
      </div>
      <button type="button" className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} tabIndex={-1} />

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
