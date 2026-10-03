import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, DefList, Modal, Input, Select, Textarea, StatusBadge, Badge } from '../../components/ui.jsx';
import { money, date, dateTime, percent, number, toCents, inputDate } from '../../utils/format.js';
import { LOAN_STATUS, INSTALLMENT_STATUS, AMORTIZATION, FREQUENCY, PAYMENT_METHODS_APP, RATE_CHECK } from '../../utils/labels.js';

const OPEN = ['desembolsado', 'al_dia', 'en_mora'];
const pendingOf = (i) => Math.max(0, i.principalDue + i.interestDue + i.feesDue + i.lateInterestAccrued - i.principalPaid - i.interestPaid - i.feesPaid - i.lateInterestPaid - i.waived);
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function LoanDetail() {
  const { id } = useParams();
  const { can, org } = useAppAuth();
  const { data, error, loading, reload } = useAppApi(`/loans/${id}`);
  const cash = useAppApi(can('cash.read') ? '/cash-accounts' : null);
  const { run, busy } = useAppAction();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { loan: l, installments, payments } = data;
  const cur = l.currency;
  const active = org.status === 'activa';
  const isOpen = OPEN.includes(l.status);
  const free = l.amortization === 'abonos_libres';
  const exigible = installments.filter((i) => new Date(i.dueDate) <= new Date() && i.status !== 'pagada').reduce((a, i) => a + pendingOf(i), 0);
  const close = () => setModal(null);
  const done = async (fn, msg) => { const r = await run(fn, msg); if (r.ok) { close(); reload(); } return r; };

  const openPayment = () => {
    setForm({ amount: '', method: 'efectivo', cashAccountId: cash.data?.[0]?._id ?? '', paidAt: inputDate(new Date()), reference: '', excessMode: free ? 'capital' : 'proximas_cuotas', key: newKey() });
    setModal('pay');
  };

  return (
    <>
      <PageHeader back={<Link to="/prestamos" className="back">Préstamos</Link>}
        title={`Préstamo ${l.loanNumber}`}
        subtitle={<><StatusBadge map={LOAN_STATUS} value={l.status} /><Link to={`/deudores/${l.borrowerId?._id}`}>{l.borrowerId?.firstName} {l.borrowerId?.lastName}</Link><span className="muted">{l.borrowerId?.phone}</span></>}
        actions={active && <>
          {['solicitud', 'aprobado'].includes(l.status) && can('loan.disburse') && <Button onClick={() => { setForm({ disbursementDate: inputDate(new Date()), firstDueDate: '' }); setModal('disburse'); }}>Desembolsar</Button>}
          {isOpen && can('payment.create') && <Button onClick={openPayment}>Registrar pago</Button>}
          {isOpen && <Button variant="ghost" loading={busy && modal === null} onClick={() => run(() => appApi(`/loans/${id}/refresh`, { method: 'POST' }), 'Saldos y mora actualizados').then((r) => r.ok && reload())}>Actualizar mora</Button>}
        </>} />

      <section className="ledger ledger-compact" aria-label="Saldos del préstamo">
        <dl className="ledger-cells">
          <div><dt>Capital prestado</dt><dd className="dd-money">{money(l.principal, cur)}</dd></div>
          <div><dt>Saldo de capital</dt><dd className="dd-money">{money(l.balancePrincipal, cur)}</dd></div>
          <div><dt>Vencido por pagar</dt><dd className={`dd-money ${exigible ? 'tone-bad' : ''}`}>{money(exigible, cur)}</dd></div>
          <div><dt>Mora acumulada</dt><dd className="dd-money">{money(l.balanceLateInterest, cur)}</dd></div>
          <div><dt>Total pagado</dt><dd className="dd-money">{money(l.totalPaid, cur)}</dd></div>
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
                        <td className="num">{money(i.principalPaid + i.interestPaid + i.feesPaid + i.lateInterestPaid, cur)}</td>
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
                      <td className="small">{[
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
              ['Mora', Number(l.lateRate) ? `${percent(l.lateRate)} ${l.lateRateBasis}` : 'Sin interés de mora'],
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
      <Modal open={modal === 'pay'} title="Registrar pago" onClose={close} width={560}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button loading={busy} disabled={!form.amount || !form.cashAccountId} onClick={() => done(() => appApi('/payments', {
            method: 'POST',
            headers: { 'Idempotency-Key': form.key },
            body: {
              loanId: id, amount: toCents(form.amount), method: form.method, cashAccountId: form.cashAccountId,
              paidAt: new Date(`${form.paidAt}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
              ...(form.reference && { externalReference: form.reference }), excessMode: form.excessMode,
            },
          }), 'Pago registrado')}>Registrar pago</Button></>}>
        <p className="modal-lead">Vencido hoy: <strong>{money(exigible, cur)}</strong>{l.nextDueDate && <>. Próxima cuota: {money(l.nextDueAmount, cur)} el {date(l.nextDueDate)}</>}.</p>
        <div className="form-grid">
          <Input label="Valor recibido" inputMode="numeric" value={form.amount ?? ''} onChange={set('amount')} hint={form.amount ? money(toCents(form.amount), cur) : 'Sin puntos ni comas'} autoFocus />
          <Input label="Fecha" type="date" value={form.paidAt ?? ''} onChange={set('paidAt')} max={inputDate(new Date())} />
          <Select label="Medio" value={form.method ?? 'efectivo'} onChange={set('method')} options={PAYMENT_METHODS_APP} />
          {cash.data?.length ? (
            <Select label="Caja" value={form.cashAccountId ?? ''} onChange={set('cashAccountId')} options={Object.fromEntries(cash.data.map((c) => [c._id, c.name]))} />
          ) : <p className="field-hint">No tienes cajas. <Link to="/cajas">Crea una</Link> para registrar pagos.</p>}
          <Input label="Referencia" value={form.reference ?? ''} onChange={set('reference')} hint="N° de transferencia, opcional" className="span-2" />
          {!free && (
            <Select label="Si paga más de lo vencido" value={form.excessMode ?? 'proximas_cuotas'} onChange={set('excessMode')} className="span-2"
              options={{ proximas_cuotas: 'Adelantar las cuotas siguientes', capital: 'Abonar a capital y bajar el valor de las cuotas' }} />
          )}
        </div>
        <p className="field-hint">Se aplica en este orden: mora, cargos, interés y capital. {free && 'Lo que sobre después del interés va a capital.'}</p>
      </Modal>

      {/* ---------- Desembolsar ---------- */}
      <Modal open={modal === 'disburse'} title="Desembolsar préstamo" onClose={close}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button loading={busy} onClick={() => done(() => appApi(`/loans/${id}/disburse`, { method: 'POST', body: { disbursementDate: form.disbursementDate, ...(form.firstDueDate && { firstDueDate: form.firstDueDate }) } }), 'Préstamo desembolsado')}>Desembolsar {money(l.principal, cur)}</Button></>}>
        <p className="modal-lead">Al desembolsar se generan las cuotas y el préstamo empieza a correr.</p>
        <div className="form-grid">
          <Input label="Fecha del desembolso" type="date" value={form.disbursementDate ?? ''} onChange={set('disbursementDate')} />
          <Input label="Primera cuota" type="date" value={form.firstDueDate ?? ''} onChange={set('firstDueDate')} hint="Vacío: un período después" />
        </div>
      </Modal>

      {/* ---------- Reversar ---------- */}
      <Modal open={modal === 'reverse'} title={`Reversar el recibo ${form.receipt ?? ''}`} onClose={close}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button variant="danger" loading={busy} disabled={(form.reason ?? '').trim().length < 5} onClick={() => done(() => appApi(`/payments/${form.paymentId}/reverse`, { method: 'POST', body: { reason: form.reason } }), 'Pago reversado')}>Reversar pago</Button></>}>
        <p className="modal-lead">El pago no se borra: se crea un movimiento en negativo y las cuotas vuelven a quedar como antes.</p>
        <Textarea label="Motivo" value={form.reason ?? ''} onChange={set('reason')} hint="Por ejemplo: valor digitado por error" />
        <Badge tone="warn">Esta acción queda registrada</Badge>
      </Modal>
    </>
  );
}
