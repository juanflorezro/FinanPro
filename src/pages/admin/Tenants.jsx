import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../api/useApi.js';
import { api } from '../../api/client.js';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { useAction } from '../../components/useAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, StatusBadge, Empty, Pagination, SearchInput, Select, Modal, Input, Textarea } from '../../components/ui.jsx';
import { date } from '../../utils/format.js';
import { TENANT_STATUS, SUB_STATUS, COUNTRIES } from '../../utils/labels.js';
import { useDebounced } from '../../utils/useDebounced.js';

const EMPTY = { legalName: '', tradeName: '', taxIdType: 'NIT', taxId: '', country: 'CO', contactName: '', contactEmail: '', contactPhone: '', city: '', address: '', internalNotes: '' };

export function TenantForm({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="form-grid">
      <Input label="Razón social" required value={value.legalName} onChange={set('legalName')} className="span-2" />
      <Input label="Nombre comercial" value={value.tradeName} onChange={set('tradeName')} hint="Opcional. Es el que ve el cliente en los correos." className="span-2" />
      <Select label="Tipo de documento" value={value.taxIdType} onChange={set('taxIdType')} options={{ NIT: 'NIT', CC: 'Cédula', CE: 'Cédula de extranjería', RUT: 'RUT', RFC: 'RFC', OTRO: 'Otro' }} />
      <Input label="Número" value={value.taxId} onChange={set('taxId')} />
      <Input label="Persona de contacto" value={value.contactName} onChange={set('contactName')} />
      <Input label="Teléfono" type="tel" value={value.contactPhone} onChange={set('contactPhone')} />
      <Input label="Correo" type="email" required value={value.contactEmail} onChange={set('contactEmail')} hint="Con este correo el dueño entrará a crear su organización." className="span-2" />
      <Select label="País" value={value.country} onChange={set('country')} options={COUNTRIES} />
      <Input label="Ciudad" value={value.city} onChange={set('city')} />
      <Input label="Dirección" value={value.address} onChange={set('address')} className="span-2" />
      <Textarea label="Notas internas" value={value.internalNotes} onChange={set('internalNotes')} hint="Solo las ve tu equipo." className="span-2" />
    </div>
  );
}

export const cleanTenant = (v) => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x != null));

export default function Tenants() {
  const navigate = useNavigate();
  const { can } = useAdminAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q, 300);
  const { data, error, loading, reload } = useApi('/admin/tenants', { q: search, status, page, limit: 20 });

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { run, busy } = useAction();

  async function create() {
    const created = await run(() => api('/admin/tenants', { method: 'POST', body: cleanTenant(form) }), 'Cliente registrado');
    if (created?._id) navigate(`/admin/clientes/${created._id}`);
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Las empresas que compran FinanPro. Desde aquí las habilitas y registras sus pagos."
        actions={can('finanzas') && <Button onClick={() => { setForm(EMPTY); setCreating(true); }}>Registrar cliente</Button>}
      />

      <Panel flush>
        <div className="toolbar">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nombre, correo o NIT" />
          <Select aria-label="Estado" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={Object.fromEntries(Object.entries(TENANT_STATUS).map(([k, [t]]) => [k, t]))} placeholder="Todos los estados" />
        </div>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : data.items.length === 0 ? (
          <Empty title={search || status ? 'Ningún cliente coincide con la búsqueda' : 'Todavía no tienes clientes'} action={!search && !status && can('finanzas') && <Button variant="secondary" onClick={() => setCreating(true)}>Registrar el primero</Button>}>
            {!search && !status && 'Registra la empresa, asígnale un plan y habilita su correo para que empiece.'}
          </Empty>
        ) : (
          <>
            <table className="table table-click">
              <thead><tr><th>Cliente</th><th>Documento</th><th>Plan</th><th>Suscripción</th><th>Estado</th><th>Registrado</th></tr></thead>
              <tbody>
                {data.items.map((t) => (
                  <tr key={t._id} onClick={() => navigate(`/admin/clientes/${t._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/clientes/${t._id}`)}>
                    <td><strong>{t.tradeName || t.legalName}</strong><span className="cell-sub">{t.contactEmail}</span></td>
                    <td>{t.taxId ? `${t.taxIdType} ${t.taxId}` : '—'}</td>
                    <td>{t.subscription?.planId?.name ?? '—'}</td>
                    <td>{t.subscription ? <><StatusBadge map={SUB_STATUS} value={t.subscription.status} /><span className="cell-sub">hasta {date(t.subscription.currentPeriodEnd)}</span></> : '—'}</td>
                    <td><StatusBadge map={TENANT_STATUS} value={t.status} /></td>
                    <td>{date(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} limit={20} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>

      <Modal open={creating} title="Registrar cliente" onClose={() => setCreating(false)} width={640}
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button loading={busy} disabled={!form.legalName || !form.contactEmail} onClick={create}>Registrar cliente</Button></>}>
        <TenantForm value={form} onChange={setForm} />
      </Modal>
    </>
  );
}
