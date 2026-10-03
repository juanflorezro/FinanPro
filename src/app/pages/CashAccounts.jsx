import { useState } from 'react';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Modal, Input, Select, Pagination, Badge } from '../../components/ui.jsx';
import { FilterBar } from '../../components/Filters.jsx';
import { useUrlFilters, paginate } from '../../utils/useUrlFilters.js';
import { rules, validate, serverFieldErrors, focusFirstError } from '../../utils/validation.js';

const RULES = {
  name: [rules.required('Ponle un nombre a la caja'), rules.minLen(2)],
  accountMask: [rules.digitsLen(4, 'Escribe los últimos 4 números')],
};

const TYPES = { efectivo: 'Efectivo', banco: 'Cuenta bancaria', billetera_digital: 'Billetera digital (Nequi, Daviplata)' };

export default function CashAccounts() {
  const { can, org } = useAppAuth();
  const { data, error, loading, reload } = useAppApi('/cash-accounts', { todas: '1' });
  const F = useUrlFilters({ q: '', tipo: '', estado: 'activas' });
  const fv = F.values;
  const list = (data ?? []).filter((c) => (!fv.q || c.name.toLowerCase().includes(fv.q.toLowerCase()) || (c.bankName ?? '').toLowerCase().includes(fv.q.toLowerCase()))
    && (!fv.tipo || c.type === fv.tipo) && (fv.estado === 'todas' || (fv.estado === 'activas' ? c.isActive : !c.isActive)));
  const pg = paginate(list, F.page, F.limit);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'efectivo', bankName: '', accountMask: '' });
  const [errors, setErrors] = useState({});
  const { run, busy } = useAppAction();
  const set = (k) => (e) => { const v = { ...form, [k]: e.target.value }; setForm(v); if (Object.keys(errors).length) setErrors(validate(v, RULES)); };

  return (
    <>
      <PageHeader title="Cajas" subtitle="Dónde entra la plata: efectivo, cuentas de banco o billeteras. Cada pago se registra en una caja."
        actions={can('cash.create') && org.status === 'activa' && <Button onClick={() => { setErrors({}); setOpen(true); }}>Crear caja</Button>} />
      <Panel flush>
        {(data?.length ?? 0) > 0 && (
          <FilterBar search={fv.q} onSearch={(x) => F.set('q', x)} placeholder="Nombre o banco"
            quick={<>
              <Select aria-label="Tipo" value={fv.tipo} onChange={(e) => F.set('tipo', e.target.value)} options={TYPES} placeholder="Todos los tipos" />
              <Select aria-label="Estado" value={fv.estado} onChange={(e) => F.set('estado', e.target.value)} options={{ activas: 'Activas', inactivas: 'Inactivas', todas: 'Todas' }} />
            </>} />
        )}
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !data?.length ? (
          <Empty title="No tienes cajas" action={can('cash.create') && <Button variant="secondary" onClick={() => setOpen(true)}>Crear la primera</Button>}>Necesitas al menos una para registrar pagos.</Empty>
        ) : list.length > 0 && (
          <table className="table">
            <thead><tr><th>Nombre</th><th>Tipo</th><th>Cuenta</th><th>Estado</th></tr></thead>
            <tbody>{pg.rows.map((c) => <tr key={c._id}><td><strong>{c.name}</strong></td><td>{TYPES[c.type]}</td><td>{c.bankName ? `${c.bankName}${c.accountMask ? ` terminada en ${c.accountMask}` : ''}` : '—'}</td><td>{c.isActive ? <Badge tone="ok">Activa</Badge> : <Badge tone="neutral">Inactiva</Badge>}</td></tr>)}</tbody>
          </table>
        )}
        {data?.length > 0 && !list.length && <Empty title="Ninguna caja con esos filtros" />}
        <Pagination page={pg.page} limit={F.limit} total={pg.total} onPage={F.setPage} onLimit={F.setLimit} />
      </Panel>
      <Modal open={open} title="Crear caja" onClose={() => setOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button loading={busy} onClick={async () => {
            const found = validate(form, RULES);
            setErrors(found);
            if (Object.keys(found).length) { focusFirstError(); return; }
            const body = { name: form.name.trim(), type: form.type, ...(form.bankName && { bankName: form.bankName }), ...(form.accountMask && { accountMask: form.accountMask }) };
            const r = await run(() => appApi('/cash-accounts', { method: 'POST', body }), 'Caja creada', { silentCodes: ['VALIDATION_ERROR', 'DUPLICATE'] });
            if (!r.ok) { setErrors(r.error.code === 'DUPLICATE' ? { name: 'Ya tienes una caja con ese nombre' } : serverFieldErrors(r.error)); return; }
            if (r.ok) { setOpen(false); setForm({ name: '', type: 'efectivo', bankName: '', accountMask: '' }); reload(); }
          }}>Crear caja</Button></>}>
        <div className="form-grid">
          <Input label="Nombre" required value={form.name} onChange={set('name')} placeholder="Caja principal" error={errors.name} className="span-2" />
          <Select label="Tipo" required value={form.type} onChange={set('type')} options={TYPES} className="span-2" />
          {form.type !== 'efectivo' && <>
            <Input label="Banco o billetera" value={form.bankName} onChange={set('bankName')} hint="Opcional" />
            <Input label="Últimos 4 dígitos" inputMode="numeric" maxLength={4} value={form.accountMask} onChange={set('accountMask')} error={errors.accountMask} hint="Opcional" />
          </>}
        </div>
      </Modal>
    </>
  );
}
