import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles/base.css';
import './styles/admin.css';
import { AdminAuthProvider } from './auth/AdminAuth.jsx';
import { ToastProvider } from './components/Toast.jsx';
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AdminAuthProvider>
          <Routes>
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
            </Route>
            {/* La app de las empresas vivirá en "/"; por ahora redirige al panel */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </AdminAuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
