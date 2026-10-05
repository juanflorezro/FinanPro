import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Modal, Input, Select, Pagination, Badge, Textarea } from '../../components/ui.jsx';
import { FilterBar } from '../../components/Filters.jsx';
import { useUrlFilters, paginate } from '../../utils/useUrlFilters.js';
import { rules, validate, serverFieldErrors, focusFirstError } from '../../utils/validation.js';
import { money, date, toCents } from '../../utils/format.js';

export const CASH_TYPES = { efectivo: 'Efectivo', banco: 'Cuenta bancaria', billetera_digital: 'Billetera digital (Nequi, Daviplata)' };
export const CASH_RULES = {
  name: [rules.required('Ponle un nombre a la caja'), rules.minLen(2)],
  accountMask: [rules.digitsLen(4, 'Escribe los últimos 4 números')],
  openingBalance: [(v) => (v === '' || v == null || /^\d+([.,]\d{1,2})?$/.test(String(v)) ? null : 'Escribe solo números')],
};

/** Formulario de caja (crear y editar). */
export function CashForm({ form, setForm, errors, editing, hasActivity }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="form-grid">
      <Input label="Nombre" required value={form.name} onChange={set('name')} placeholder="Caja principal" error={errors.name} className="span-2" />
      <Select label="Tipo" required value={form.type} onChange={set('type')} options={CASH_TYPES} />
      <Input label="Saldo inicial" inputMode="numeric" value={form.openingBalance} onChange={set('openingBalance')} error={errors.openingBalance}
        disabled={editing && hasActivity} hint={editing && hasActivity ? 'No se cambia: la caja ya tiene movimientos' : 'Dinero con el que arranca la caja'} />
      {form.type !== 'efectivo' && <>
        <Input label="Banco o billetera" value={form.bankName} onChange={set('bankName')} hint="Opcional" />
        <Input label="Últimos 4 dígitos" inputMode="numeric" maxLength={4} value={form.accountMask} onChange={set('accountMask')} error={errors.accountMask} hint="Opcional" />
      </>}
      <Textarea label="Notas" value={form.notes} onChange={set('notes')} className="span-2" rows={2} hint="Opcional. Ej.: caja de la sede centro" />
    </div>
  );
}

export const cashBody = (f) => ({
  name: f.name.trim(), type: f.type, notes: f.notes?.trim() ?? '',
  ...(f.type !== 'efectivo' ? { bankName: f.bankName?.trim() ?? '', accountMask: f.accountMask ?? '' } : { bankName: '', accountMask: '' }),
  ...(f.openingBalance !== '' && f.openingBalance != null && { openingBalance: toCents(f.openingBalance) }),
});

const EMPTY = { name: '', type: 'efectivo', bankName: '', accountMask: '', openingBalance: '', notes: '' };

export default function CashAccounts() {
  const navigate = useNavigate();
  const { can, org } = useAppAuth();
  const { data, error, loading, reload } = useAppApi('/cash-accounts', { todas: '1', saldos: '1' });
  const F = useUrlFilters({ q: '', tipo: '', estado: 'activas' });
  const fv = F.values;
  const list = (data ?? []).filter((c) => (!fv.q || c.name.toLowerCase().includes(fv.q.toLowerCase()) || (c.bankName ?? '').toLowerCase().includes(fv.q.toLowerCase()))
    && (!fv.tipo || c.type === fv.tipo) && (fv.estado === 'todas' || (fv.estado === 'activas' ? c.isActive : !c.isActive)));
  const pg = paginate(list, F.page, F.limit);
  const total = list.filter((c) => c.isActive).reduce((a, c) => a + (c.balance ?? 0), 0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const { run, busy } = useAppAction();

  async function create() {
    const found = validate(form, CASH_RULES);
    setErrors(found);
    if (Object.keys(found).length) { focusFirstError(); return; }
    const r = await run(() => appApi('/cash-accounts', { method: 'POST', body: cashBody(form) }), 'Caja creada', { silentCodes: ['VALIDATION_ERROR', 'DUPLICATE'] });
    if (!r.ok) { setErrors(r.error.code === 'DUPLICATE' ? { name: 'Ya tienes una caja con ese nombre' } : serverFieldErrors(r.error)); return; }
    setOpen(false); setForm(EMPTY); reload();
  }

  return (
    <>
      <PageHeader title="Cajas" subtitle="Dónde entra y sale el dinero: pagos, desembolsos, gastos, traslados y cierres diarios."
        actions={can('cash.create') && org.status === 'activa' && <Button onClick={() => { setErrors({}); setForm(EMPTY); setOpen(true); }}>Crear caja</Button>} />

      {data?.length > 0 && (
        <section className="ledger ledger-compact">
          <div className="ledger-main"><span className="ledger-label">Dinero en cajas activas</span><span className="ledger-figure">{money(total, org.currency)}</span></div>
        </section>
      )}

      <Panel flush>
        {(data?.length ?? 0) > 0 && (
          <FilterBar search={fv.q} onSearch={(x) => F.set('q', x)} placeholder="Nombre o banco"
            quick={<>
              <Select aria-label="Tipo" value={fv.tipo} onChange={(e) => F.set('tipo', e.target.value)} options={CASH_TYPES} placeholder="Todos los tipos" />
              <Select aria-label="Estado" value={fv.estado} onChange={(e) => F.set('estado', e.target.value)} options={{ activas: 'Activas', inactivas: 'Inactivas', todas: 'Todas' }} />
            </>} />
        )}
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !data?.length ? (
          <Empty title="Todavía no tienes cajas">Crea al menos una (por ejemplo "Caja principal" o "Nequi") para registrar pagos.</Empty>
        ) : !list.length ? <Empty title="Ninguna caja con esos filtros" /> : (
          <table className="table table-click">
            <thead><tr><th>Caja</th><th>Tipo</th><th className="num">Saldo</th><th>Último cierre</th><th>Estado</th></tr></thead>
            <tbody>{pg.rows.map((c) => (
              <tr key={c._id} onClick={() => navigate(`/cajas/${c._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/cajas/${c._id}`)}>
                <td><strong>{c.name}</strong>{c.bankName && <span className="cell-sub">{c.bankName}{c.accountMask ? ` ****${c.accountMask}` : ''}</span>}</td>
                <td>{CASH_TYPES[c.type]}</td>
                <td className={`num ${c.balance < 0 ? 'tone-bad' : ''}`}>{money(c.balance, c.currency)}</td>
                <td>{c.lastClosingDate ? date(c.lastClosingDate) : <span className="muted">Sin cierres</span>}</td>
                <td>{c.isActive ? <Badge tone="ok">Activa</Badge> : <Badge tone="neutral">Inactiva</Badge>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        <Pagination page={pg.page} limit={F.limit} total={pg.total} onPage={F.setPage} onLimit={F.setLimit} />
      </Panel>

      <Modal open={open} title="Crear caja" onClose={() => setOpen(false)} width={560}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={busy} onClick={create}>Crear caja</Button></>}>
        <CashForm form={form} setForm={(v) => { setForm(v); if (Object.keys(errors).length) setErrors(validate(v, CASH_RULES)); }} errors={errors} />
      </Modal>
    </>
  );
}
