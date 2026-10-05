import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, DefList, Modal, Input, Select, Textarea, StatusBadge, Badge } from '../../components/ui.jsx';
import { money, date, dateTime, percent, number, toCents, inputDate } from '../../utils/format.js';
import { rules, validate, focusFirstError } from '../../utils/validation.js';
import { ExportButton } from '../../components/ExportButton.jsx';
import { LOAN_STATUS, INSTALLMENT_STATUS, AMORTIZATION, FREQUENCY, PAYMENT_METHODS_APP, RATE_CHECK } from '../../utils/labels.js';

const OPEN = ['desembolsado', 'al_dia', 'en_mora'];
const pendingOf = (i) => Math.max(0, i.principalDue + i.interestDue + i.feesDue + i.lateInterestAccrued - i.principalPaid - i.interestPaid - i.feesPaid - i.lateInterestPaid - i.waived);
const PAY_MODES = [
  { id: 'automatico', label: 'Automático', help: 'Lo vencido primero: mora, interés y capital' },
  { id: 'cuotas', label: 'Pagar cuotas', help: 'Elige qué cuotas paga' },
  { id: 'intereses', label: 'Solo intereses', help: 'Mora e interés, también adelantado; el capital no baja' },
  { id: 'capital', label: 'Abono a capital', help: 'Baja la cuota o el plazo' },
  { id: 'liquidacion', label: 'Pago total', help: 'Cancela el préstamo hoy' },
];
const CONCEPTS = {
  todo: { label: 'Todo lo pendiente', comps: [] },
  interes: { label: 'Solo intereses', comps: ['interes'] },
  mora: { label: 'Solo mora', comps: ['mora'] },
  interes_mora: { label: 'Intereses y mora', comps: ['mora', 'interes'] },
};
const COMP_PENDING = {
  mora: (i) => i.lateInterestAccrued - i.lateInterestPaid,
  cargo: (i) => i.feesDue - i.feesPaid,
  interes: (i) => i.interestDue - i.interestPaid,
  capital: (i) => i.principalDue - i.principalPaid,
};
const COMP_NAME = { interes: 'interés', mora: 'mora', cargo: 'cargos', capital: 'capital' };
const EFFECT = { reducir_cuota: 'reduce la cuota', reducir_plazo: 'reduce el plazo' };
/** Cómo se aplicó el pago, para que se distinga un abono extraordinario de un pago de cuota. */
function modeLabel(p) {
  if (p.isReversal) return null;
  if (p.applyTo === 'capital' || (!p.applyTo && p.triggeredReschedule)) return `Abono extraordinario a capital${p.capitalEffect ? `, ${EFFECT[p.capitalEffect]}` : ''}`;
  if (p.applyTo === 'liquidacion') return 'Pago total';
  if (p.applyTo === 'intereses') return 'Solo intereses';
  if (p.applyTo === 'cuotas') return `Cuota${p.targetNumbers?.length > 1 ? 's' : ''} ${(p.targetNumbers ?? []).join(', ')}${p.components?.length ? `, solo ${p.components.map((c) => COMP_NAME[c]).join(' y ')}` : ''}`;
  return null;
}
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function LoanDetail() {
  const { id } = useParams();
  const { can, org } = useAppAuth();
  const { data, error, loading, reload } = useAppApi(`/loans/${id}`);
  const cash = useAppApi(can('cash.read') ? '/cash-accounts' : null);
  const { run, busy } = useAppAction();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [payoff, setPayoff] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const guard = (schema) => { const found = validate(form, schema); setErrors(found); if (Object.keys(found).length) { focusFirstError(); return false; } return true; };

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { loan: l, installments, payments } = data;
  const cur = l.currency;
  const active = org.status === 'activa';
  const isOpen = OPEN.includes(l.status);
  const free = l.amortization === 'abonos_libres';
  const exigible = installments.filter((i) => new Date(i.dueDate) <= new Date() && i.status !== 'pagada').reduce((a, i) => a + pendingOf(i), 0);
  const close = () => { setModal(null); setErrors({}); };
  // Totales del plan vigente: intereses de todas las cuotas y lo que falta por pagar (capital + interés + mora + cargos)
  const planInst = installments.filter((i) => !['anulada', 'condonada'].includes(i.status));
  const planTotals = {
    interest: planInst.reduce((a, i) => a + i.interestDue, 0),
    interestPending: planInst.reduce((a, i) => a + Math.max(i.interestDue - i.interestPaid, 0), 0),
    remaining: planInst.filter((i) => i.status !== 'pagada').reduce((a, i) => a + pendingOf(i), 0)
      + Math.max(l.balancePrincipal - planInst.filter((i) => i.status !== 'pagada').reduce((a, i) => a + Math.max(i.principalDue - i.principalPaid, 0), 0), 0),
  };
  // Totales pagados por concepto (los reversos restan porque vienen en negativo)
  const paidTotals = payments.reduce((t, p) => ({
    principal: t.principal + (p.appliedPrincipal ?? 0), interest: t.interest + (p.appliedInterest ?? 0),
    late: t.late + (p.appliedLateInterest ?? 0), credit: t.credit + (p.unappliedAmount ?? 0),
  }), { principal: 0, interest: 0, late: 0, credit: 0 });
  const done = async (fn, msg) => { const r = await run(fn, msg); if (r.ok) { close(); reload(); } return r; };

  const openInstallments = installments.filter((i) => !['pagada', 'anulada', 'condonada'].includes(i.status)).sort((a, b) => a.number - b.number);
  const now = new Date();
  const dueNow = openInstallments.filter((i) => new Date(i.dueDate) <= now);
  const nextOpen = openInstallments.find((i) => new Date(i.dueDate) > now);
  const interestPayable = dueNow.reduce((a, i) => a + (i.lateInterestAccrued - i.lateInterestPaid) + (i.interestDue - i.interestPaid), 0)
    + (nextOpen ? (nextOpen.lateInterestAccrued - nextOpen.lateInterestPaid) + (nextOpen.interestDue - nextOpen.interestPaid) : 0);
  const pesosText = (c) => String(Math.round(c) / 100);
  const interestMax = openInstallments.reduce((a, i) => a + Math.max(i.lateInterestAccrued - i.lateInterestPaid, 0) + Math.max(i.interestDue - i.interestPaid, 0), 0);

  const openPayment = () => {
    setPayoff(null);
    setForm({ applyTo: 'automatico', amount: '', method: 'efectivo', cashAccountId: cash.data?.[0]?._id ?? '', paidAt: inputDate(new Date()), reference: '', notes: '', excessMode: free ? 'capital' : 'proximas_cuotas', capitalEffect: 'reducir_cuota', targets: [], key: newKey() });
    setModal('pay');
  };
  const loadPayoff = (day) => {
    setPayoff(null);
    appApi(`/loans/${id}/payoff?date=${day ?? form.paidAt}`).then((p) => { setPayoff(p); setForm((f) => ({ ...f, amount: pesosText(p.total) })); }).catch((e) => setErrors({ amount: e.message }));
  };
  const chooseMode = (mode) => {
    setErrors({});
    const next = { ...form, applyTo: mode };
    if (mode === 'intereses') next.amount = pesosText(interestPayable);
    if (mode === 'cuotas') { next.concept = next.concept ?? 'todo'; next.targets = dueNow.length ? dueNow.map((i) => i.number) : nextOpen ? [nextOpen.number] : []; next.amount = pesosText(amountFor(next.targets, next.concept)); }
    if (mode === 'automatico' || mode === 'capital') next.amount = '';
    setForm(next);
    if (mode === 'liquidacion') loadPayoff(form.paidAt);
  };
  const amountFor = (targets, concept) => {
    const comps = CONCEPTS[concept ?? 'todo'].comps;
    return openInstallments.filter((i) => targets.includes(i.number))
      .reduce((a, i) => a + (comps.length ? comps.reduce((x, c) => x + Math.max(COMP_PENDING[c](i), 0), 0) : pendingOf(i)), 0);
  };
  const toggleTarget = (n) => {
    const targets = (form.targets ?? []).includes(n) ? form.targets.filter((x) => x !== n) : [...(form.targets ?? []), n].sort((a, b) => a - b);
    setForm({ ...form, targets, amount: pesosText(amountFor(targets, form.concept)) });
  };

  return (
    <>
      <PageHeader back={<Link to="/prestamos" className="back">Préstamos</Link>}
        title={`Préstamo ${l.loanNumber}`}
        subtitle={<><StatusBadge map={LOAN_STATUS} value={l.status} /><Link to={`/deudores/${l.borrowerId?._id}`}>{l.borrowerId?.firstName} {l.borrowerId?.lastName}</Link><span className="muted">{l.borrowerId?.phone}</span></>}
        actions={<>
          <ExportButton path={`/exports/loans/${id}.xlsx`} label="Estado de cuenta" />
          <Link to={`/soporte?nuevo=1&prestamo=${id}&numero=${l.loanNumber}`} className="btn btn-ghost">Pedir ayuda</Link>
          {active && <>
          {['solicitud', 'aprobado'].includes(l.status) && can('loan.disburse') && <Button onClick={() => { setForm({ disbursementDate: inputDate(new Date()), firstDueDate: '' }); setModal('disburse'); }}>Desembolsar</Button>}
          {isOpen && can('payment.create') && <Button onClick={openPayment}>Registrar pago</Button>}
          {isOpen && <Button variant="ghost" loading={busy && modal === null} onClick={() => run(() => appApi(`/loans/${id}/refresh`, { method: 'POST' }), 'Saldos y mora actualizados').then((r) => r.ok && reload())}>Actualizar mora</Button>}
          </>}
        </>} />

      <section className="ledger ledger-compact" aria-label="Saldos del préstamo">
        <dl className="ledger-cells">
          <div><dt>Capital prestado</dt><dd className="dd-money">{money(l.principal, cur)}</dd></div>
          <div><dt>Saldo de capital</dt><dd className="dd-money">{money(l.balancePrincipal, cur)}</dd></div>
          <div><dt>Vencido por pagar</dt><dd className={`dd-money ${exigible ? 'tone-bad' : ''}`}>{money(exigible, cur)}</dd></div>
          <div><dt>Mora acumulada</dt><dd className="dd-money">{money(l.balanceLateInterest, cur)}</dd></div>
          <div><dt>Total pagado</dt><dd className="dd-money">{money(l.totalPaid, cur)}</dd></div>
          <div><dt>Saldo total por pagar</dt><dd className="dd-money">{money(planTotals.remaining, cur)}</dd></div>
          <div><dt>Intereses totales</dt><dd className="dd-money">{money(planTotals.interest, cur)}</dd></div>
          <div><dt>Intereses pendientes</dt><dd className="dd-money">{money(planTotals.interestPending, cur)}</dd></div>
          <div><dt>Capital pagado</dt><dd className="dd-money">{money(paidTotals.principal, cur)}</dd></div>
          <div><dt>Intereses pagados</dt><dd className="dd-money">{money(paidTotals.interest, cur)}</dd></div>
          {paidTotals.late > 0 && <div><dt>Mora pagada</dt><dd className="dd-money">{money(paidTotals.late, cur)}</dd></div>}
          {paidTotals.credit > 0 && <div><dt>Saldo a favor</dt><dd className="dd-money">{money(paidTotals.credit, cur)}</dd></div>}
          <div><dt>Próxima cuota</dt><dd className="dd-small">{l.nextDueDate ? <>{date(l.nextDueDate)}<br />{money(l.nextDueAmount, cur)}</> : '—'}</dd></div>
        </dl>
      </section>

      <div className="grid-main">
        <div className="stack">
          <Panel title={free ? 'Períodos de interés' : 'Cuotas'} flush>
            {installments.length ? (
              <div className="table-scroll">
                <table className="table compact-cells">
                  <thead><tr><th>#</th><th>Vence</th><th className="num">Capital</th><th className="num">Interés</th><th className="num">Mora</th><th className="num">Pagado</th><th className="num">Pendiente</th><th>Estado</th></tr></thead>
                  <tbody>
                    {installments.map((i) => (
                      <tr key={i._id}>
                        <td>{i.number}</td>
                        <td className="nowrap">{date(i.dueDate)}{i.daysPastDue > 0 && <span className="cell-sub tone-bad">{i.daysPastDue} días</span>}</td>
                        <td className="num">{money(i.principalDue, cur)}</td>
                        <td className="num">{money(i.interestDue, cur)}</td>
                        <td className="num">{money(i.lateInterestAccrued, cur)}</td>
                        <td className="num">{money(i.principalPaid + i.interestPaid + i.feesPaid + i.lateInterestPaid, cur)}
                          {(i.interestPaid > 0 || i.principalPaid > 0 || i.lateInterestPaid > 0) && (
                            <span className="cell-sub">{[i.interestPaid > 0 && `Int. ${money(i.interestPaid, cur)}`, i.lateInterestPaid > 0 && `Mora ${money(i.lateInterestPaid, cur)}`, i.principalPaid > 0 && `Cap. ${money(i.principalPaid, cur)}`].filter(Boolean).join(' · ')}</span>
                          )}
                        </td>
                        <td className="num"><strong>{money(pendingOf(i), cur)}</strong></td>
                        <td><StatusBadge map={INSTALLMENT_STATUS} value={i.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty title="Aún no hay cuotas">Se generan al desembolsar el préstamo.</Empty>}
          </Panel>

          <Panel title="Pagos" flush>
            {payments.length ? (
              <table className="table">
                <thead><tr><th>Recibo</th><th>Fecha</th><th>Aplicado a</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>{p.receiptNumber}<span className="cell-sub">{PAYMENT_METHODS_APP[p.method]}</span></td>
                      <td className="nowrap">{dateTime(p.paidAt)}</td>
                      <td className="small">{modeLabel(p) && <strong className="pay-tag">{modeLabel(p)}</strong>}{[
                        p.appliedLateInterest && `Mora ${money(p.appliedLateInterest, cur)}`,
                        p.appliedInterest && `Interés ${money(p.appliedInterest, cur)}`,
                        p.appliedPrincipal && `Capital ${money(p.appliedPrincipal, cur)}`,
                        p.unappliedAmount && `A favor ${money(p.unappliedAmount, cur)}`,
                      ].filter(Boolean).join(', ') || '—'}</td>
                      <td className={`num ${p.isReversal ? 'tone-bad' : ''}`}>{money(p.amount, cur)}{p.status === 'reversado' && <span className="cell-sub">Reversado</span>}{p.isReversal && <span className="cell-sub">Reverso</span>}</td>
                      <td className="num">{active && can('payment.reverse') && !p.isReversal && p.status === 'aplicado' && (
                        <Button variant="danger-ghost" size="sm" onClick={() => { setForm({ paymentId: p._id, receipt: p.receiptNumber, reason: '' }); setModal('reverse'); }}>Reversar</Button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty title="Sin pagos registrados" />}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Condiciones">
            <DefList items={[
              ['Tasa', `${percent(l.rate, 4)} ${l.rateBasis}${l.rateBasis === 'anual' ? ` ${l.rateKind}` : ''}`],
              ['Equivale a', `${percent(l.rateMonthly, 3)} mensual, ${percent(l.rateAnnual)} EA`],
              ['Tope legal', <StatusBadge key="c" map={RATE_CHECK} value={l.rateCapCheck ?? 'no_aplica'} />],
              ['Forma de pago', AMORTIZATION[l.amortization]?.[0]],
              ['Frecuencia', FREQUENCY[l.frequency]],
              !free && ['Cuotas', number(l.termCount)],
              ['Mora', Number(l.lateRate) ? `${percent(l.lateRate)} ${l.lateRateBasis}, sobre ${l.lateInterestBase === 'capital_e_interes' ? 'capital e intereses' : 'capital'} vencido` : 'Sin interés de mora'],
              ['Días de gracia', number(l.graceDays)],
              ['Tipo', l.lendingRegime === 'informal' ? 'Informal' : 'Formal'],
              ['Desembolso', date(l.disbursementDate)],
              l.maturityDate && ['Vencimiento final', date(l.maturityDate)],
              l.notes && ['Notas', l.notes],
            ]} />
          </Panel>
        </div>
      </div>

      {/* ---------- Registrar pago ---------- */}
      <Modal open={modal === 'pay'} title="Registrar pago" onClose={close} width={640}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button loading={busy} disabled={form.applyTo === 'capital' && exigible > 0} onClick={() => {
            const extra = {};
            if (form.applyTo === 'cuotas' && !(form.targets ?? []).length) extra.targets = 'Elige al menos una cuota';
            if (form.applyTo === 'liquidacion' && payoff && toCents(form.amount || 0) < payoff.total) extra.amount = `Para el pago total se necesitan ${money(payoff.total, cur)}`;
            if (!guard({
              amount: [rules.required('Escribe el valor recibido'), rules.money()],
              cashAccountId: [rules.required('Elige la caja donde entra el dinero')],
              paidAt: [rules.required('Elige la fecha del pago')],
            }) || Object.keys(extra).length) { setErrors((e) => ({ ...e, ...extra })); return; }
            done(() => appApi('/payments', {
              method: 'POST',
              headers: { 'Idempotency-Key': form.key },
              body: {
                loanId: id, amount: toCents(form.amount), method: form.method, cashAccountId: form.cashAccountId,
                paidAt: new Date(`${form.paidAt}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
                ...(form.reference && { externalReference: form.reference }), ...(form.notes && { notes: form.notes }),
                applyTo: form.applyTo,
                ...(form.applyTo === 'automatico' && { excessMode: form.excessMode }),
                ...(form.applyTo === 'cuotas' && { targetNumbers: form.targets, ...(CONCEPTS[form.concept ?? 'todo'].comps.length && { components: CONCEPTS[form.concept].comps }) }),
                ...(form.applyTo === 'capital' && { capitalEffect: form.capitalEffect }),
              },
            }), form.applyTo === 'liquidacion' ? 'Préstamo pagado en su totalidad' : 'Pago registrado');
          }}>Registrar pago</Button></>}>
        <p className="modal-lead">Vencido hoy: <strong>{money(exigible, cur)}</strong>{l.nextDueDate && <>. Próxima cuota: {money(l.nextDueAmount, cur)} el {date(l.nextDueDate)}</>}.</p>

        <div className="pay-modes" role="radiogroup" aria-label="Cómo aplicar el pago">
          {PAY_MODES.filter((m) => !(free && m.id === 'cuotas')).map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={form.applyTo === m.id} className={`pay-mode ${form.applyTo === m.id ? 'on' : ''}`} onClick={() => chooseMode(m.id)}>
              <strong>{m.label}</strong><span>{m.help}</span>
            </button>
          ))}
        </div>

        {form.applyTo === 'cuotas' && (
          <>
            <Select label="Qué pagar de esas cuotas" value={form.concept ?? 'todo'} onChange={(e) => setForm({ ...form, concept: e.target.value, amount: pesosText(amountFor(form.targets ?? [], e.target.value)) })}
              options={Object.fromEntries(Object.entries(CONCEPTS).map(([k, v]) => [k, v.label]))}
              hint="Si el valor no alcanza, se cubre primero la cuota más antigua. Ej.: $50.000 de interés entre el período 1 y el 3." />
            <div className="pay-installments section-gap">
              {openInstallments.map((i) => {
                const comps = CONCEPTS[form.concept ?? 'todo'].comps;
                const amount = comps.length ? comps.reduce((x, c) => x + Math.max(COMP_PENDING[c](i), 0), 0) : pendingOf(i);
                return (
                  <label key={i._id} className={`check ${(form.targets ?? []).includes(i.number) ? 'on' : ''}`}>
                    <input type="checkbox" checked={(form.targets ?? []).includes(i.number)} onChange={() => toggleTarget(i.number)} />
                    <span>Cuota {i.number} <span className="muted small">vence {date(i.dueDate)}</span>
                      <span className="pay-breakdown">Interés {money(Math.max(COMP_PENDING.interes(i), 0), cur)}{COMP_PENDING.mora(i) > 0 && ` · Mora ${money(COMP_PENDING.mora(i), cur)}`} · Capital {money(Math.max(COMP_PENDING.capital(i), 0), cur)}</span>
                    </span>
                    <strong>{money(amount, cur)}</strong>
                  </label>
                );
              })}
              {errors.targets && <p className="field-error">{errors.targets}</p>}
            </div>
          </>
        )}
        {form.applyTo === 'intereses' && (
          <p className="notice">Vencido y período en curso: <strong>{money(interestPayable, cur)}</strong>. Si pagas más, se adelantan los intereses de los períodos siguientes en orden, hasta <strong>{money(interestMax, cur)}</strong> (todos los intereses y la mora pendientes). El capital no baja con este abono.</p>
        )}
        {form.applyTo === 'capital' && (exigible > 0
          ? <p className="notice notice-bad">Para abonar a capital el préstamo debe estar al día. Primero registra el pago de lo vencido ({money(exigible, cur)}).</p>
          : (
            <div className="form-grid">
              {!free && (
                <div className="span-2 radio-row" role="radiogroup" aria-label="Efecto del abono">
                  <label className="check"><input type="radio" name="effect" checked={form.capitalEffect === 'reducir_cuota'} onChange={() => setForm({ ...form, capitalEffect: 'reducir_cuota' })} /> Reducir el valor de las cuotas</label>
                  <label className="check"><input type="radio" name="effect" checked={form.capitalEffect === 'reducir_plazo'} onChange={() => setForm({ ...form, capitalEffect: 'reducir_plazo' })} /> Reducir el número de cuotas</label>
                </div>
              )}
              <p className="field-hint span-2">Saldo de capital: {money(l.balancePrincipal, cur)}. Por ley (Ley 1555 de 2012) el deudor puede abonar a capital sin penalidad y elegir si reduce la cuota o el plazo.</p>
            </div>
          ))}
        {form.applyTo === 'liquidacion' && (
          !payoff ? <Loading /> : (
            <div className="payoff">
              <dl>
                <div><dt>Capital pendiente</dt><dd>{money(payoff.principal, cur)}</dd></div>
                {payoff.overdueInterest > 0 && <div><dt>Interés vencido</dt><dd>{money(payoff.overdueInterest, cur)}</dd></div>}
                {payoff.currentInterest > 0 && <div><dt>Interés del período hasta hoy</dt><dd>{money(payoff.currentInterest, cur)}</dd></div>}
                {payoff.lateInterest > 0 && <div><dt>Mora</dt><dd>{money(payoff.lateInterest, cur)}</dd></div>}
                {payoff.fees > 0 && <div><dt>Cargos</dt><dd>{money(payoff.fees, cur)}</dd></div>}
                <div className="total"><dt>Total para cancelar hoy</dt><dd>{money(payoff.total, cur)}</dd></div>
              </dl>
              <p className="field-hint">Sin penalidad por pago anticipado; el interés se cobra solo por los días corridos (Ley 1555 de 2012). El préstamo queda pagado.</p>
            </div>
          )
        )}

        <div className="form-grid section-gap">
          <Input label="Valor recibido" required inputMode="numeric" value={form.amount ?? ''} onChange={set('amount')} error={errors.amount} hint={form.amount ? money(toCents(form.amount), cur) : 'Sin puntos ni comas'} />
          <Input label="Fecha" required type="date" value={form.paidAt ?? ''} onChange={(e) => { setForm({ ...form, paidAt: e.target.value }); if (form.applyTo === 'liquidacion') loadPayoff(e.target.value); }} max={inputDate(new Date())} error={errors.paidAt} />
          <Select label="Medio" required value={form.method ?? 'efectivo'} onChange={set('method')} options={PAYMENT_METHODS_APP} />
          {cash.data?.length ? (
            <Select label="Caja" required value={form.cashAccountId ?? ''} onChange={set('cashAccountId')} options={Object.fromEntries(cash.data.map((c) => [c._id, c.name]))} error={errors.cashAccountId} />
          ) : <p className="field-error">No tienes cajas. <Link to="/cajas">Crea una</Link> para registrar pagos.</p>}
          <Input label="Referencia" value={form.reference ?? ''} onChange={set('reference')} hint="N° de transferencia, opcional" />
          <Input label="Nota" value={form.notes ?? ''} onChange={set('notes')} hint="Opcional, sale en el recibo" />
          {form.applyTo === 'automatico' && !free && (
            <Select label="Si paga más de lo vencido" value={form.excessMode ?? 'proximas_cuotas'} onChange={set('excessMode')} className="span-2"
              options={{ proximas_cuotas: 'Adelantar las cuotas siguientes', capital: 'Abonar a capital y bajar el valor de las cuotas' }} />
          )}
        </div>
        {form.applyTo === 'automatico' && <p className="field-hint">Se aplica en este orden: mora, cargos, interés y capital, empezando por la cuota más antigua. {free && 'Lo que sobre después del interés va a capital.'}</p>}
      </Modal>

      {/* ---------- Desembolsar ---------- */}
      <Modal open={modal === 'disburse'} title="Desembolsar préstamo" onClose={close}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button loading={busy} onClick={() => done(() => appApi(`/loans/${id}/disburse`, { method: 'POST', body: { disbursementDate: form.disbursementDate, ...(form.firstDueDate && { firstDueDate: form.firstDueDate }), ...(form.cashAccountId && { cashAccountId: form.cashAccountId }) } }), 'Préstamo desembolsado')}>Desembolsar {money(l.principal, cur)}</Button></>}>
        <p className="modal-lead">Al desembolsar se generan las cuotas y el préstamo empieza a correr.</p>
        <div className="form-grid">
          <Input label="Fecha del desembolso" type="date" value={form.disbursementDate ?? ''} onChange={set('disbursementDate')} />
          <Input label="Primera cuota" type="date" value={form.firstDueDate ?? ''} onChange={set('firstDueDate')} hint="Vacío: un período después" />
          {cash.data?.length > 0 && (
            <Select label="Caja de donde sale el dinero" value={form.cashAccountId ?? ''} onChange={set('cashAccountId')} className="span-2" placeholder="No registrar salida de caja"
              options={Object.fromEntries(cash.data.map((c) => [c._id, c.name]))} hint="Queda como egreso en el libro de la caja" />
          )}
        </div>
      </Modal>

      {/* ---------- Reversar ---------- */}
      <Modal open={modal === 'reverse'} title={`Reversar el recibo ${form.receipt ?? ''}`} onClose={close}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button variant="danger" loading={busy} onClick={() => guard({ reason: [rules.required('Escribe el motivo del reverso'), rules.minLen(5, 'Escribe al menos 5 caracteres')] }) && done(() => appApi(`/payments/${form.paymentId}/reverse`, { method: 'POST', body: { reason: form.reason } }), 'Pago reversado')}>Reversar pago</Button></>}>
        <p className="modal-lead">El pago no se borra: se crea un movimiento en negativo y las cuotas vuelven a quedar como antes.</p>
        <Textarea label="Motivo" required value={form.reason ?? ''} onChange={set('reason')} error={errors.reason} hint="Por ejemplo: valor digitado por error" />
        <Badge tone="warn">Esta acción queda registrada</Badge>
      </Modal>
    </>
  );
}
