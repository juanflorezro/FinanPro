import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { appApi, setOrgId } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { Button, Input, Select, Loading } from '../../components/ui.jsx';
import { COUNTRIES } from '../../utils/labels.js';
import { AuthShell } from './Login.jsx';

const CURRENCY = { CO: 'COP', MX: 'MXN', PE: 'PEN', EC: 'USD', CL: 'CLP', ES: 'EUR', US: 'USD' };

export default function CreateOrg() {
  const { me, ready, loadMe, logout } = useAppAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', legalName: '', taxId: '', country: 'CO' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ready) return <div className="boot"><Loading /></div>;
  if (!me) return <Navigate to="/login" replace />;

  if (!me.canCreateOrg) {
    return (
      <AuthShell title="Casi listo" lede="Tu cuenta existe, pero todavía no perteneces a ninguna empresa.">
        <div className="login-form">
          <h1>Sin empresa asignada</h1>
          <p className="muted">Pide a tu empresa que te invite desde Equipo, o si vas a contratar FinanPro, escríbenos para habilitar tu correo. Después entra de nuevo.</p>
          <Button variant="secondary" className="btn-block" onClick={async () => { await loadMe(); }}>Ya me invitaron, revisar de nuevo</Button>
          <button type="button" className="link-btn" onClick={logout}>Cerrar sesión</button>
        </div>
      </AuthShell>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const org = await appApi('/orgs', {
        method: 'POST',
        body: { name: form.name.trim(), country: form.country, currency: CURRENCY[form.country] ?? 'USD', ...(form.legalName && { legalName: form.legalName.trim() }), ...(form.taxId && { taxId: form.taxId.trim() }) },
      });
      setOrgId(org._id);
      await loadMe();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Crea tu empresa" lede="Es tu espacio privado: tus deudores, préstamos y pagos solo los ve tu equipo.">
      <form className="login-form" onSubmit={submit}>
        <h1>Datos de tu empresa</h1>
        <p className="muted">Puedes cambiarlos después en Configuración.</p>
        <Input label="Nombre comercial" value={form.name} onChange={set('name')} placeholder="Créditos del Caribe" />
        <Input label="Razón social" value={form.legalName} onChange={set('legalName')} hint="Opcional" />
        <Input label="NIT o documento" value={form.taxId} onChange={set('taxId')} hint="Opcional" />
        <Select label="País" value={form.country} onChange={set('country')} options={COUNTRIES} hint={`Moneda: ${CURRENCY[form.country] ?? 'USD'}`} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" loading={busy} disabled={form.name.trim().length < 2} className="btn-block">Crear empresa</Button>
      </form>
    </AuthShell>
  );
}
