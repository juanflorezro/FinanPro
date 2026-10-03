import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import './styles/base.css';
import './styles/admin.css';
import './styles/app.css';
import './styles/portal.css';
import { ToastProvider } from './components/Toast.jsx';

// Panel de la plataforma
import { AdminAuthProvider } from './auth/AdminAuth.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminLogin from './pages/admin/Login.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Tenants from './pages/admin/Tenants.jsx';
import TenantDetail from './pages/admin/TenantDetail.jsx';
import Organizations from './pages/admin/Organizations.jsx';
import OrganizationDetail from './pages/admin/OrganizationDetail.jsx';
import Plans from './pages/admin/Plans.jsx';
import RateCaps from './pages/admin/RateCaps.jsx';
import Audit from './pages/admin/Audit.jsx';
import Admins from './pages/admin/Admins.jsx';
import SupportDesk from './pages/admin/SupportDesk.jsx';

// App de las empresas
import { AppAuthProvider } from './app/AppAuth.jsx';
import AppLayout from './app/AppLayout.jsx';
import Login from './app/pages/Login.jsx';
import Recover from './app/pages/Recover.jsx';
import CreateOrg from './app/pages/CreateOrg.jsx';
import Home from './app/pages/Home.jsx';
import Borrowers from './app/pages/Borrowers.jsx';
import BorrowerDetail from './app/pages/BorrowerDetail.jsx';
import Loans from './app/pages/Loans.jsx';
import NewLoan from './app/pages/NewLoan.jsx';
import LoanDetail from './app/pages/LoanDetail.jsx';
import Payments from './app/pages/Payments.jsx';
import CashAccounts from './app/pages/CashAccounts.jsx';
import Team from './app/pages/Team.jsx';
import Settings from './app/pages/Settings.jsx';
import Support from './app/pages/Support.jsx';
import NotFound from './app/pages/NotFound.jsx';

// Portal del deudor
import PortalLayout from './portal/PortalLayout.jsx';
import PortalLogin from './portal/pages/PortalLogin.jsx';
import PortalHome from './portal/pages/PortalHome.jsx';
import PortalLoan from './portal/pages/PortalLoan.jsx';

const AdminScope = () => <AdminAuthProvider><Outlet /></AdminAuthProvider>;
const AppScope = () => <AppAuthProvider><Outlet /></AppAuthProvider>;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AdminScope />}>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="clientes" element={<Tenants />} />
              <Route path="clientes/:id" element={<TenantDetail />} />
              <Route path="organizaciones" element={<Organizations />} />
              <Route path="organizaciones/:id" element={<OrganizationDetail />} />
              <Route path="planes" element={<Plans />} />
              <Route path="tasas" element={<RateCaps />} />
              <Route path="bitacora" element={<Audit />} />
              <Route path="administradores" element={<Admins />} />
              <Route path="soporte" element={<SupportDesk />} />
            </Route>
          </Route>

          {/* Portal público del deudor: /p/slug-de-la-empresa */}
          <Route path="/p/:slug" element={<PortalLayout />}>
            <Route index element={<PortalLogin />} />
            <Route path="inicio" element={<PortalHome />} />
            <Route path="prestamo/:id" element={<PortalLoan />} />
          </Route>

          <Route element={<AppScope />}>
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar" element={<Recover />} />
            <Route path="/crear-organizacion" element={<CreateOrg />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="deudores" element={<Borrowers />} />
              <Route path="deudores/:id" element={<BorrowerDetail />} />
              <Route path="prestamos" element={<Loans />} />
              <Route path="prestamos/nuevo" element={<NewLoan />} />
              <Route path="prestamos/:id" element={<LoanDetail />} />
              <Route path="pagos" element={<Payments />} />
              <Route path="cajas" element={<CashAccounts />} />
              <Route path="equipo" element={<Team />} />
              <Route path="configuracion" element={<Settings />} />
              <Route path="soporte" element={<Support />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
