import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Pagination, SearchInput, Modal, Input, Select, StatusBadge } from '../../components/ui.jsx';
import { useDebounced } from '../../utils/useDebounced.js';
import { toCents, fromCents } from '../../utils/format.js';

export const DOC_TYPES = { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', PPT: 'Permiso por protección temporal', PAS: 'Pasaporte', NIT: 'NIT' };
export const BORROWER_STATUS = { activo: ['Activo', 'ok'], inactivo: ['Inactivo', 'neutral'], bloqueado: ['Bloqueado', 'bad'] };
const EMPTY = { docType: 'CC', docNumber: '', firstName: '', lastName: '', phone: '', phoneAlt: '', email: '', address: '', neighborhood: '', city: '', occupation: '', monthlyIncome: '', riskRating: 'B' };

export function BorrowerForm({ value, onChange, editing }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="form-grid">
      <Select label="Tipo de documento" value={value.docType} onChange={set('docType')} options={DOC_TYPES} disabled={editing} />
      <Input label="Número de documento" value={value.docNumber} onChange={set('docNumber')} disabled={editing} inputMode="numeric" />
      <Input label="Nombres" value={value.firstName} onChange={set('firstName')} />
      <Input label="Apellidos" value={value.lastName} onChange={set('lastName')} />
      <Input label="Celular" type="tel" value={value.phone} onChange={set('phone')} />
      <Input label="Otro teléfono" type="tel" value={value.phoneAlt} onChange={set('phoneAlt')} hint="Opcional" />
      <Input label="Correo" type="email" value={value.email} onChange={set('email')} hint="Opcional" className="span-2" />
      <Input label="Dirección" value={value.address} onChange={set('address')} className="span-2" />
      <Input label="Barrio" value={value.neighborhood} onChange={set('neighborhood')} />
      <Input label="Ciudad" value={value.city} onChange={set('city')} />
      <Input label="Ocupación" value={value.occupation} onChange={set('occupation')} />
      <Input label="Ingresos mensuales" inputMode="numeric" value={value.monthlyIncome} onChange={set('monthlyIncome')} hint="Opcional" />
      <Select label="Calificación" value={value.riskRating} onChange={set('riskRating')} options={{ A: 'A, excelente', B: 'B, buena', C: 'C, regular', D: 'D, riesgosa' }} />
    </div>
  );
}

export function borrowerBody(v, editing) {
  const body = {};
  for (const [k, x] of Object.entries(v)) {
    if (x === '' || x == null) continue;
    if (['docType', 'docNumber'].includes(k) && editing) continue;
    if (!(k in EMPTY)) continue;
    body[k] = k === 'monthlyIncome' ? toCents(x) : String(x).trim();
  }
  return body;
}

export const borrowerToForm = (b) => ({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, b[k] ?? ''])), monthlyIncome: b.monthlyIncome ? fromCents(b.monthlyIncome) : '' });

export default function Borrowers() {
  const navigate = useNavigate();
  const { can, org } = useAppAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q, 300);
  const { data, error, loading, reload } = useAppApi('/borrowers', { q: search, page, limit: 20 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { run, busy } = useAppAction();
  const canCreate = can('borrower.create') && org.status === 'activa';

  async function create() {
    const r = await run(() => appApi('/borrowers', { method: 'POST', body: borrowerBody(form) }), 'Deudor registrado');
    if (r.ok) navigate(`/deudores/${r.result._id}`);
  }

  return (
    <>
      <PageHeader title="Deudores" subtitle="Las personas a las que les prestas."
        actions={canCreate && <Button onClick={() => { setForm(EMPTY); setOpen(true); }}>Registrar deudor</Button>} />
      <Panel flush>
        <div className="toolbar"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nombre, documento o código" /></div>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : data.items.length === 0 ? (
          <Empty title={search ? 'Nadie coincide con la búsqueda' : 'Todavía no tienes deudores'} action={!search && canCreate && <Button variant="secondary" onClick={() => setOpen(true)}>Registrar el primero</Button>} />
        ) : (
          <>
            <table className="table table-click">
              <thead><tr><th>Nombre</th><th>Documento</th><th>Celular</th><th>Ciudad</th><th>Estado</th></tr></thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b._id} onClick={() => navigate(`/deudores/${b._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/deudores/${b._id}`)}>
                    <td><strong>{b.firstName} {b.lastName}</strong><span className="cell-sub">{b.code}</span></td>
                    <td className="nowrap">{b.docType} {b.docNumber}</td>
                    <td className="nowrap">{b.phone}</td>
                    <td>{b.city ?? '—'}</td>
                    <td><StatusBadge map={BORROWER_STATUS} value={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} limit={20} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
      <Modal open={open} title="Registrar deudor" onClose={() => setOpen(false)} width={660}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button loading={busy} disabled={!form.docNumber || !form.firstName || !form.lastName || form.phone.length < 7} onClick={create}>Registrar deudor</Button></>}>
        <BorrowerForm value={form} onChange={setForm} />
      </Modal>
    </>
  );
}
