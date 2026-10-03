import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Pagination, Modal, Input, Select, StatusBadge, FormErrors } from '../../components/ui.jsx';
import { FilterBar } from '../../components/Filters.jsx';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { rules, validate, serverFieldErrors, focusFirstError } from '../../utils/validation.js';
import { useDebounced } from '../../utils/useDebounced.js';
import { ExportButton } from '../../components/ExportButton.jsx';
import { toCents, fromCents } from '../../utils/format.js';

export const DOC_TYPES = { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', PPT: 'Permiso por protección temporal', PAS: 'Pasaporte', NIT: 'NIT' };
export const BORROWER_STATUS = { activo: ['Activo', 'ok'], inactivo: ['Inactivo', 'neutral'], bloqueado: ['Bloqueado', 'bad'] };
const EMPTY = { docType: 'CC', docNumber: '', firstName: '', lastName: '', phone: '', phoneAlt: '', email: '', address: '', neighborhood: '', city: '', occupation: '', monthlyIncome: '', riskRating: 'B' };

export const BORROWER_RULES = {
  docNumber: [rules.required('Escribe el número de documento'), rules.document()],
  firstName: [rules.required('Escribe los nombres'), rules.minLen(2)],
  lastName: [rules.required('Escribe los apellidos'), rules.minLen(2)],
  phone: [rules.required('Escribe el celular'), rules.phone()],
  phoneAlt: [rules.phone()],
  email: [rules.email()],
  monthlyIncome: [rules.money('Escribe solo números, sin puntos ni comas')],
};

export function BorrowerForm({ value, onChange, editing, errors = {} }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="form-grid">
      <p className="form-legend span-2">Los campos con <span className="req">*</span> son obligatorios.</p>
      <FormErrors errors={errors} />
      <Select label="Tipo de documento" required value={value.docType} onChange={set('docType')} options={DOC_TYPES} disabled={editing} />
      <Input label="Número de documento" required value={value.docNumber} onChange={set('docNumber')} disabled={editing} inputMode="numeric" error={errors.docNumber} hint={editing ? 'No se puede cambiar' : 'Sin puntos ni espacios'} />
      <Input label="Nombres" required value={value.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="off" />
      <Input label="Apellidos" required value={value.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="off" />
      <Input label="Celular" required type="tel" value={value.phone} onChange={set('phone')} error={errors.phone} hint="Solo números, ej. 3001234567" />
      <Input label="Otro teléfono" type="tel" value={value.phoneAlt} onChange={set('phoneAlt')} error={errors.phoneAlt} hint="Opcional" />
      <Input label="Correo" type="email" value={value.email} onChange={set('email')} error={errors.email} hint="Opcional" className="span-2" autoComplete="off" />
      <Input label="Dirección" value={value.address} onChange={set('address')} error={errors.address} hint="Opcional" className="span-2" autoComplete="off" />
      <Input label="Barrio" value={value.neighborhood} onChange={set('neighborhood')} hint="Opcional" />
      <Input label="Ciudad" value={value.city} onChange={set('city')} hint="Opcional" />
      <Input label="Ocupación" value={value.occupation} onChange={set('occupation')} hint="Opcional" />
      <Input label="Ingresos mensuales" inputMode="numeric" value={value.monthlyIncome} onChange={set('monthlyIncome')} error={errors.monthlyIncome} hint="Opcional" />
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
    if (k === 'monthlyIncome') body[k] = toCents(x);
    else if (k === 'phone' || k === 'phoneAlt') body[k] = String(x).replace(/\D/g, '');
    else body[k] = String(x).trim();
  }
  return body;
}

export const borrowerToForm = (b) => ({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, b[k] ?? ''])), monthlyIncome: b.monthlyIncome ? fromCents(b.monthlyIncome) : '' });

const FDEF = { q: '', estado: '', calificacion: '', ciudad: '', desde: '', hasta: '', orden: 'nombre' };

export default function Borrowers() {
  const navigate = useNavigate();
  const { can, org } = useAppAuth();
  const F = useUrlFilters(FDEF);
  const v = F.values;
  const q = useDebounced(v.q, 300);
  const city = useDebounced(v.ciudad, 400);
  const query = { q, status: v.estado, riskRating: v.calificacion, city, from: v.desde, to: v.hasta, sort: v.orden };
  const { data, error, loading, reload } = useAppApi('/borrowers', { ...query, page: F.page, limit: F.limit });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const { run, busy } = useAppAction();
  const canCreate = can('borrower.create') && org.status === 'activa';
  const set = (k) => (e) => F.set(k, e.target.value);

  async function create() {
    const found = validate(form, BORROWER_RULES);
    setErrors(found);
    if (Object.keys(found).length) { focusFirstError(); return; }
    const r = await run(() => appApi('/borrowers', { method: 'POST', body: borrowerBody(form) }), 'Deudor registrado', { silentCodes: ['VALIDATION_ERROR', 'DUPLICATE'] });
    if (r.ok) { navigate(`/deudores/${r.result._id}`); return; }
    const server = serverFieldErrors(r.error);
    if (Object.keys(server).length) { setErrors(server); focusFirstError(); }
    else if (['VALIDATION_ERROR', 'DUPLICATE'].includes(r.error.code)) setErrors({ docNumber: r.error.message });
  }

  const chips = [
    v.estado && { label: `Estado: ${BORROWER_STATUS[v.estado]?.[0]}`, onClear: () => F.set('estado', '') },
    v.calificacion && { label: `Calificación ${v.calificacion}`, onClear: () => F.set('calificacion', '') },
    v.ciudad && { label: `Ciudad: ${v.ciudad}`, onClear: () => F.set('ciudad', '') },
    (v.desde || v.hasta) && { label: `Registrados ${v.desde || '…'} a ${v.hasta || '…'}`, onClear: () => F.update({ desde: '', hasta: '' }) },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Deudores" subtitle="Las personas a las que les prestas."
        actions={<><ExportButton path="/exports/borrowers.xlsx" query={query} />{canCreate && <Button onClick={() => { setForm(EMPTY); setErrors({}); setOpen(true); }}>Registrar deudor</Button>}</>} />
      <Panel flush>
        <FilterBar
          search={v.q} onSearch={(x) => F.set('q', x)} placeholder="Nombre, documento, código o celular"
          quick={<Select aria-label="Estado" value={v.estado} onChange={set('estado')} options={Object.fromEntries(Object.entries(BORROWER_STATUS).map(([k, [t]]) => [k, t]))} placeholder="Todos los estados" />}
          sort={<Select aria-label="Ordenar" value={v.orden} onChange={set('orden')} options={{ nombre: 'Por apellido', recientes: 'Más recientes', antiguos: 'Más antiguos' }} />}
          advanced={<>
            <Select label="Calificación" value={v.calificacion} onChange={set('calificacion')} options={{ A: 'A, excelente', B: 'B, buena', C: 'C, regular', D: 'D, riesgosa' }} placeholder="Todas" />
            <Input label="Ciudad" value={v.ciudad} onChange={set('ciudad')} />
            <div className="range"><span>Fecha de registro</span>
              <Input aria-label="Desde" type="date" value={v.desde} onChange={set('desde')} />
              <Input aria-label="Hasta" type="date" value={v.hasta} onChange={set('hasta')} />
            </div>
          </>}
          chips={chips} onReset={F.reset}
        />
        {loading && !data ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !data?.items?.length ? (
          <Empty title={F.active ? 'Nadie coincide con esos filtros' : 'Todavía no tienes deudores'} action={!F.active && canCreate && <Button variant="secondary" onClick={() => { setForm(EMPTY); setErrors({}); setOpen(true); }}>Registrar el primero</Button>} />
        ) : (
          <div className={loading ? 'is-refreshing' : ''}>
            <table className="table table-click">
              <thead><tr><th>Nombre</th><th>Documento</th><th>Celular</th><th>Ciudad</th><th>Calificación</th><th>Estado</th></tr></thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b._id} onClick={() => navigate(`/deudores/${b._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/deudores/${b._id}`)}>
                    <td><strong>{b.firstName} {b.lastName}</strong><span className="cell-sub">{b.code}</span></td>
                    <td className="nowrap">{b.docType} {b.docNumber}</td>
                    <td className="nowrap">{b.phone}</td>
                    <td>{b.city ?? '—'}</td>
                    <td>{b.riskRating}</td>
                    <td><StatusBadge map={BORROWER_STATUS} value={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={F.page} limit={F.limit} total={data.total} onPage={F.setPage} onLimit={F.setLimit} />
          </div>
        )}
      </Panel>
      <Modal open={open} title="Registrar deudor" onClose={() => setOpen(false)} width={660}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button loading={busy} onClick={create}>Registrar deudor</Button></>}>
        <BorrowerForm value={form} onChange={(x) => { setForm(x); if (Object.keys(errors).length) setErrors(validate(x, BORROWER_RULES)); }} errors={errors} />
      </Modal>
    </>
  );
}
