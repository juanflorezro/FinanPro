import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Modal, Input, Select, Textarea, Badge } from '../../components/ui.jsx';
import { money, date, dateTime, toCents, fromCents, inputDate } from '../../utils/format.js';
import { rules, validate, focusFirstError } from '../../utils/validation.js';
import { CASH_TYPES, CASH_RULES, CashForm, cashBody } from './CashAccounts.jsx';

const KIND = {
  pago: 'Pago', ingreso: 'Ingreso', egreso: 'Egreso', desembolso: 'Desembolso',
  traslado_entrada: 'Traslado recibido', traslado_salida: 'Traslado enviado', ajuste_arqueo: 'Ajuste de arqueo',
};
const CATEGORIES = ['Aporte de capital', 'Gastos administrativos', 'Arriendo', 'Nómina', 'Transporte', 'Papelería', 'Impuestos', 'Retiro de socios', 'Otro'];

export default function CashDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, org } = useAppAuth();
  const [range, setRange] = useState({ from: inputDate(new Date(Date.now() - 29 * 86_400_000)), to: inputDate(new Date()) });
  const summary = useAppApi(`/cash-accounts/${id}/summary`, range);
  const ledger = useAppApi(`/cash-accounts/${id}/ledger`, range);
  const closings = useAppApi(`/cash-accounts/${id}/closings`);
  const others = useAppApi('/cash-accounts');
  const { run, busy } = useAppAction();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const reloadAll = () => { summary.reload(); ledger.reload(); closings.reload(); };
  const close = () => { setModal(null); setErrors({}); };
  const guard = (schema, extra = {}) => { const f = { ...validate(form, schema), ...extra }; setErrors(f); if (Object.keys(f).length) { focusFirstError(); return false; } return true; };

  useEffect(() => {
    if (modal !== 'closing') return;
    setPreview(null);
    appApi(`/cash-accounts/${id}/closings/preview?date=${form.date}`).then(setPreview).catch((e) => setErrors({ countedBalance: e.message }));
  }, [modal, form.date, id]);

  if (summary.loading && !summary.data) return <Loading />;
  if (summary.error) return <ErrorNote error={summary.error} onRetry={summary.reload} />;
  const s = summary.data;
  const c = s.cash;
  const cur = c.currency ?? org.currency;
  const editable = org.status === 'activa' && c.isActive;
  const canWrite = can('cash.create') && editable;
  const canManage = can('cash.update');
  const done = async (fn, msg) => { const r = await run(fn, msg); if (r.ok) { close(); reloadAll(); } return r; };
  const hasActivity = (ledger.data?.rows?.length ?? 0) > 0 || s.payments !== 0 || s.inflows !== 0 || s.outflows !== 0;

  return (
    <>
      <PageHeader back={<Link to="/cajas" className="back">Cajas</Link>} title={c.name}
        subtitle={<>{CASH_TYPES[c.type]}{c.bankName && <span className="muted">{c.bankName}{c.accountMask ? ` ****${c.accountMask}` : ''}</span>}{!c.isActive && <Badge tone="neutral">Inactiva</Badge>}</>}
        actions={<>
          {canWrite && <Button onClick={() => { setErrors({}); setForm({ type: 'ingreso', amount: '', date: inputDate(new Date()), concept: '', category: '', reference: '' }); setModal('move'); }}>Ingreso o egreso</Button>}
          {canWrite && <Button variant="secondary" onClick={() => { setErrors({}); setForm({ to: '', amount: '', date: inputDate(new Date()), concept: '' }); setModal('transfer'); }}>Trasladar</Button>}
          {canManage && editable && <Button variant="secondary" onClick={() => { setErrors({}); setForm({ date: inputDate(new Date()), counted: '', notes: '' }); setModal('closing'); }}>Arqueo y cierre</Button>}
          {canManage && <Button variant="ghost" onClick={() => { setErrors({}); setForm({ name: c.name, type: c.type, bankName: c.bankName ?? '', accountMask: c.accountMask ?? '', openingBalance: fromCents(c.openingBalance ?? 0), notes: c.notes ?? '' }); setModal('edit'); }}>Editar</Button>}
        </>} />

      <section className="ledger">
        <div className="ledger-main">
          <span className="ledger-label">Saldo actual</span>
          <span className={`ledger-figure ${s.balance < 0 ? 'tone-bad' : ''}`}>{money(s.balance, cur)}</span>
          <span className="ledger-note">{s.lastClosing ? `Último cierre: ${date(s.lastClosing.date)}` : 'Sin cierres todavía'}</span>
        </div>
        <dl className="ledger-cells">
          <div><dt>Saldo al inicio del periodo</dt><dd className="dd-money">{money(s.opening, cur)}</dd></div>
          <div><dt>Pagos recibidos ({s.paymentsCount})</dt><dd className="dd-money tone-ok">{money(s.payments, cur)}</dd></div>
          <div><dt>Otros ingresos</dt><dd className="dd-money">{money(s.inflows, cur)}</dd></div>
          <div><dt>Salidas</dt><dd className="dd-money tone-bad">{money(s.outflows, cur)}</dd></div>
        </dl>
      </section>

      <div className="grid-main">
        <Panel title="Libro de caja" flush actions={
          <div className="range-inline">
            <Input aria-label="Desde" type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <Input aria-label="Hasta" type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>}>
          {ledger.loading && !ledger.data ? <Loading /> : ledger.error ? <ErrorNote error={ledger.error} /> : !ledger.data?.rows?.length ? <Empty title="Sin movimientos en estas fechas" /> : (
            <table className="table">
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th className="num">Valor</th><th className="num">Saldo</th><th /></tr></thead>
              <tbody>
                {ledger.data.rows.map((r) => (
                  <tr key={`${r.kind}${r.id}`} className={r.voided ? 'row-deleted' : ''}>
                    <td className="nowrap">{dateTime(r.date)}</td>
                    <td>{r.concept}<span className="cell-sub">{[r.reference, r.category].filter(Boolean).join(' · ')}{r.voided ? ` · Anulado: ${r.voidReason}` : ''}</span></td>
                    <td>{KIND[r.kind] ?? r.kind}</td>
                    <td className={`num ${r.amount < 0 ? 'tone-bad' : ''}`}>{money(r.amount, cur)}</td>
                    <td className="num">{money(r.balance, cur)}</td>
                    <td className="num">{canManage && editable && ['ingreso', 'egreso', 'traslado_entrada', 'traslado_salida'].includes(r.kind) && !r.voided && (
                      <Button variant="ghost" size="sm" onClick={() => { setErrors({}); setForm({ movementId: r.id, reason: '' }); setModal('void'); }}>Anular</Button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="stack">
          <Panel title="Cierres" flush>
            {!closings.data?.length ? <p className="panel-intro" style={{ padding: '14px 22px' }}>Haz un arqueo al final del día: cuentas el dinero, lo comparas con lo esperado y cierras. Después del cierre no se puede registrar nada en fechas anteriores.</p> : (
              <ul className="list">
                {closings.data.map((k) => (
                  <li key={k._id}>
                    <div><strong>{date(k.date)}</strong><span className="muted small"> Esperado {money(k.expectedBalance, cur)}, contado {money(k.countedBalance, cur)}</span></div>
                    {k.difference === 0 ? <Badge tone="ok">Cuadra</Badge> : <Badge tone={k.difference > 0 ? 'warn' : 'bad'}>{k.difference > 0 ? 'Sobra' : 'Falta'} {money(Math.abs(k.difference), cur)}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {canManage && (
            <Panel title="Administrar">
              <p className="panel-intro small">Una caja con pagos o movimientos no se puede eliminar, para conservar el historial contable. Puedes desactivarla (con saldo en cero) para que no se use más.</p>
              <div className="row-actions wrap">
                {c.isActive
                  ? <Button variant="secondary" size="sm" loading={busy} onClick={() => done(() => appApi(`/cash-accounts/${id}`, { method: 'PATCH', body: { isActive: false } }), 'Caja desactivada')}>Desactivar</Button>
                  : <Button variant="secondary" size="sm" loading={busy} onClick={() => done(() => appApi(`/cash-accounts/${id}`, { method: 'PATCH', body: { isActive: true } }), 'Caja activada')}>Activar</Button>}
                <Button variant="danger-ghost" size="sm" loading={busy} onClick={async () => { const r = await run(() => appApi(`/cash-accounts/${id}`, { method: 'DELETE' }), 'Caja eliminada'); if (r.ok) navigate('/cajas'); }}>Eliminar</Button>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* ---- Ingreso o egreso ---- */}
      <Modal open={modal === 'move'} title="Registrar ingreso o egreso" onClose={close} width={560}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button loading={busy} onClick={() => guard({ amount: [rules.required('Escribe el valor'), rules.money()], concept: [rules.required('Escribe el concepto'), rules.minLen(3)] })
          && done(() => appApi(`/cash-accounts/${id}/movements`, { method: 'POST', body: { type: form.type, amount: toCents(form.amount), date: new Date(`${form.date}T${new Date().toTimeString().slice(0, 8)}`).toISOString(), concept: form.concept.trim(), ...(form.category && { category: form.category }), ...(form.reference && { reference: form.reference }) } }), 'Movimiento registrado')}>Registrar</Button></>}>
        <div className="form-grid">
          <Select label="Tipo" required value={form.type} onChange={set('type')} options={{ ingreso: 'Ingreso (entra dinero)', egreso: 'Egreso (sale dinero)' }} />
          <Input label="Valor" required inputMode="numeric" value={form.amount ?? ''} onChange={set('amount')} error={errors.amount} hint={form.amount ? money(toCents(form.amount), cur) : 'Sin puntos ni comas'} />
          <Input label="Concepto" required value={form.concept ?? ''} onChange={set('concept')} error={errors.concept} className="span-2" placeholder={form.type === 'ingreso' ? 'Ej.: Aporte de capital socio' : 'Ej.: Pago arriendo oficina octubre'} />
          <Select label="Categoría" value={form.category ?? ''} onChange={set('category')} options={Object.fromEntries(CATEGORIES.map((x) => [x, x]))} placeholder="Sin categoría" />
          <Input label="Fecha" type="date" value={form.date ?? ''} onChange={set('date')} max={inputDate(new Date())} />
          <Input label="Soporte o referencia" value={form.reference ?? ''} onChange={set('reference')} className="span-2" hint="N° de factura, comprobante o transferencia" />
        </div>
      </Modal>

      {/* ---- Traslado ---- */}
      <Modal open={modal === 'transfer'} title="Trasladar a otra caja" onClose={close} width={520}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button loading={busy} onClick={() => guard({ to: [rules.required('Elige la caja destino')], amount: [rules.required('Escribe el valor'), rules.money()] })
          && done(() => appApi(`/cash-accounts/${id}/transfer`, { method: 'POST', body: { toCashAccountId: form.to, amount: toCents(form.amount), date: new Date(`${form.date}T${new Date().toTimeString().slice(0, 8)}`).toISOString(), ...(form.concept && { concept: form.concept }) } }), 'Traslado registrado')}>Trasladar</Button></>}>
        <p className="modal-lead">Disponible en {c.name}: <strong>{money(s.balance, cur)}</strong>. Ej.: consignar el efectivo del día en el banco.</p>
        <div className="form-grid">
          <Select label="Caja destino" required value={form.to ?? ''} onChange={set('to')} error={errors.to} placeholder="Elige" options={Object.fromEntries((others.data ?? []).filter((x) => x._id !== id).map((x) => [x._id, x.name]))} className="span-2" />
          <Input label="Valor" required inputMode="numeric" value={form.amount ?? ''} onChange={set('amount')} error={errors.amount} hint={form.amount ? money(toCents(form.amount), cur) : ''} />
          <Input label="Fecha" type="date" value={form.date ?? ''} onChange={set('date')} max={inputDate(new Date())} />
          <Input label="Concepto" value={form.concept ?? ''} onChange={set('concept')} className="span-2" hint="Opcional" />
        </div>
      </Modal>

      {/* ---- Arqueo y cierre ---- */}
      <Modal open={modal === 'closing'} title="Arqueo y cierre de caja" onClose={close} width={560}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button loading={busy} disabled={!preview} onClick={() => guard({ counted: [rules.required('Escribe cuánto dinero contaste')] })
          && done(() => appApi(`/cash-accounts/${id}/closings`, { method: 'POST', body: { date: form.date, countedBalance: toCents(form.counted || 0), ...(form.notes && { notes: form.notes }) } }), 'Caja cerrada')}>Cerrar caja</Button></>}>
        <div className="form-grid">
          <Input label="Fecha del cierre" type="date" value={form.date ?? ''} onChange={set('date')} max={inputDate(new Date())} />
        </div>
        {!preview ? <Loading /> : (
          <div className="payoff section-gap">
            <dl>
              <div><dt>{preview.lastClosingDate ? `Contado en el cierre del ${date(preview.lastClosingDate)}` : 'Saldo inicial'}</dt><dd>{money(preview.opening, cur)}</dd></div>
              <div><dt>Pagos recibidos ({preview.paymentsCount})</dt><dd>{money(preview.payments, cur)}</dd></div>
              {Object.entries(preview.byMethod ?? {}).map(([m, v]) => <div key={m} className="sub"><dt>· {m}</dt><dd>{money(v, cur)}</dd></div>)}
              <div><dt>Otros ingresos y traslados recibidos</dt><dd>{money(preview.inflows, cur)}</dd></div>
              <div><dt>Egresos, desembolsos y traslados</dt><dd>-{money(preview.outflows, cur)}</dd></div>
              <div className="total"><dt>Debería haber</dt><dd>{money(preview.expected, cur)}</dd></div>
            </dl>
          </div>
        )}
        <div className="form-grid section-gap">
          <Input label="Dinero contado" required inputMode="numeric" value={form.counted ?? ''} onChange={set('counted')} error={errors.counted}
            hint={preview && form.counted !== '' ? (() => { const d = toCents(form.counted || 0) - preview.expected; return d === 0 ? 'Cuadra exacto' : `${d > 0 ? 'Sobran' : 'Faltan'} ${money(Math.abs(d), cur)}`; })() : 'Lo que hay físicamente o en el extracto'} />
          <Textarea label="Observaciones" value={form.notes ?? ''} onChange={set('notes')} rows={2} hint="Obligatorio explicar si hay diferencia" />
        </div>
        <p className="field-hint">Al cerrar, la diferencia queda registrada como ajuste y no se podrán registrar pagos ni movimientos con fecha igual o anterior.</p>
      </Modal>

      {/* ---- Anular movimiento ---- */}
      <Modal open={modal === 'void'} title="Anular movimiento" onClose={close}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button variant="danger" loading={busy} onClick={() => guard({ reason: [rules.required('Escribe el motivo'), rules.minLen(5)] })
          && done(() => appApi(`/cash-accounts/${id}/movements/${form.movementId}/void`, { method: 'POST', body: { reason: form.reason } }), 'Movimiento anulado')}>Anular</Button></>}>
        <p className="modal-lead">El movimiento no se borra: queda marcado como anulado y deja de sumar al saldo. Si es un traslado, se anulan las dos partes.</p>
        <Textarea label="Motivo" required value={form.reason ?? ''} onChange={set('reason')} error={errors.reason} />
      </Modal>

      {/* ---- Editar ---- */}
      <Modal open={modal === 'edit'} title="Editar caja" onClose={close} width={560}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button loading={busy} onClick={() => {
          if (!guard(CASH_RULES)) return;
          const body = cashBody(form);
          if (hasActivity) delete body.openingBalance;
          done(() => appApi(`/cash-accounts/${id}`, { method: 'PATCH', body }), 'Caja actualizada');
        }}>Guardar</Button></>}>
        <CashForm form={form} setForm={setForm} errors={errors} editing hasActivity={hasActivity} />
      </Modal>
    </>
  );
}
