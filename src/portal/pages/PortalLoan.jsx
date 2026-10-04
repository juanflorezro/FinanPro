import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { usePortal } from '../PortalLayout.jsx';
import { Loading, ErrorNote, StatusBadge, Badge } from '../../components/ui.jsx';
import { money, date, dateTime, relativeDays, percent } from '../../utils/format.js';
import { LOAN_STATUS, INSTALLMENT_STATUS, AMORTIZATION, FREQUENCY, PAYMENT_METHODS_APP } from '../../utils/labels.js';
import { Progress, paidPercent } from './PortalHome.jsx';

export default function PortalLoan() {
  const { id, orgId } = useParams();
  const { basePath, token, call, loanPath } = usePortal();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('cuotas');
  const load = useCallback(() => call(loanPath(id, orgId)).then(setData).catch(setError), [call, loanPath, id, orgId]);
  useEffect(() => { if (token) load(); }, [token, load]);

  if (!token) return <Navigate to={basePath} replace />;
  if (error) return <ErrorNote error={error} onRetry={load} />;
  if (!data) return <Loading />;

  const { loan: l, installments, payments } = data;
  const cur = l.currency;
  const now = new Date();
  const overdue = installments.filter((i) => new Date(i.dueDate) <= now && i.pending > 0).reduce((a, i) => a + i.pending, 0);
  const totalOwed = l.balancePrincipal + l.balanceInterest + l.balanceLateInterest + l.balanceFees;
  const pct = paidPercent(l);
  const isFree = l.amortization === 'abonos_libres';

  return (
    <div className="p-loan-page">
      <div className="p-toolbar no-print">
        <Link to={`${basePath}/inicio`} className="back">Mis préstamos</Link>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>Imprimir estado de cuenta</button>
      </div>

      <div className="print-only p-print-head">
        <strong>{data.company.name}</strong> · Estado de cuenta del préstamo {l.loanNumber} · Generado el {dateTime(new Date())}
      </div>

      <section className="p-loan-hero">
        <div className="p-loan-hero-top">
          <div><span className="p-eyebrow">Préstamo {l.loanNumber}</span><h1>{money(totalOwed, cur)}</h1><span className="p-hero-sub">Saldo pendiente: capital más intereses y mora vencidos</span></div>
          <StatusBadge map={LOAN_STATUS} value={l.status} />
        </div>
        <Progress value={pct} label="Capital pagado" />
        <div className="p-hero-progress"><span>{pct}% del capital pagado</span><span>{money(l.principal - l.balancePrincipal, cur)} de {money(l.principal, cur)}</span></div>
        <div className="p-hero-grid">
          <div className={overdue > 0 ? 'late' : ''}><span>Vencido por pagar</span><strong>{money(overdue, cur)}</strong>{l.daysPastDue > 0 && <small>{l.daysPastDue} días de atraso</small>}</div>
          <div><span>Próxima cuota</span><strong>{l.nextDueDate ? money(l.nextDueAmount, cur) : '—'}</strong>{l.nextDueDate && <small>{date(l.nextDueDate)}, {relativeDays(l.nextDueDate)}</small>}</div>
          <div><span>Saldo de capital</span><strong>{money(l.balancePrincipal, cur)}</strong></div>
          <div><span>Total pagado</span><strong>{money(l.totalPaid, cur)}</strong></div>
        </div>
      </section>

      <section className="p-facts">
        <h2 className="p-section-title">Condiciones</h2>
        <dl>
          <div><dt>Tasa</dt><dd>{percent(l.rate, 4)} {l.rateBasis} ({percent(l.rateAnnual)} efectivo anual)</dd></div>
          <div><dt>Forma de pago</dt><dd>{AMORTIZATION[l.amortization]?.[0]}{!isFree && `, ${l.termCount} cuotas`}</dd></div>
          <div><dt>Frecuencia</dt><dd>{FREQUENCY[l.frequency]}</dd></div>
          <div><dt>Desembolso</dt><dd>{date(l.disbursementDate)}</dd></div>
          {l.maturityDate && <div><dt>Última cuota</dt><dd>{date(l.maturityDate)}</dd></div>}
          <div><dt>Mora</dt><dd>{Number(l.lateRate) ? `${percent(l.lateRate)} ${l.lateRateBasis}${l.graceDays ? `, ${l.graceDays} días de gracia` : ''}` : 'Sin interés de mora'}</dd></div>
        </dl>
      </section>

      <div className="tabs p-tabs no-print" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'cuotas'} className={tab === 'cuotas' ? 'on' : ''} onClick={() => setTab('cuotas')}>{isFree ? 'Períodos' : 'Cuotas'} ({installments.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'pagos'} className={tab === 'pagos' ? 'on' : ''} onClick={() => setTab('pagos')}>Mis pagos ({payments.filter((p) => !p.isReversal).length})</button>
      </div>

      <section className={`p-list-section ${tab === 'cuotas' ? '' : 'print-show'}`} hidden={tab !== 'cuotas'}>
        <h2 className="p-section-title print-only">Cuotas</h2>
        <ol className="p-installments">
          {installments.map((i) => (
            <li key={i._id} className={`st-${i.status}`}>
              <span className="p-dot" aria-hidden="true" />
              <div className="p-inst-main">
                <strong>{isFree ? 'Período' : 'Cuota'} {i.number}</strong>
                <small>Vence {date(i.dueDate)}{i.daysPastDue > 0 ? `, ${i.daysPastDue} días de atraso` : ''}</small>
              </div>
              <div className="p-inst-amounts">
                <strong>{money(i.pending > 0 ? i.pending : i.principalDue + i.interestDue + i.feesDue, cur)}</strong>
                <small>{i.pending > 0 && i.paid > 0 ? `Pagaste ${money(i.paid, cur)}` : `Capital ${money(i.principalDue, cur)}, interés ${money(i.interestDue, cur)}`}{i.lateInterest > 0 ? `, mora ${money(i.lateInterest, cur)}` : ''}</small>
              </div>
              <StatusBadge map={INSTALLMENT_STATUS} value={i.status} />
            </li>
          ))}
        </ol>
      </section>

      <section className={`p-list-section ${tab === 'pagos' ? '' : 'print-show'}`} hidden={tab !== 'pagos'}>
        <h2 className="p-section-title print-only">Pagos</h2>
        {payments.length === 0 ? <p className="muted">Todavía no hay pagos registrados.</p> : (
          <ul className="p-payments">
            {payments.map((p) => (
              <li key={p._id}>
                <div>
                  <strong>{money(p.amount, p.currency)}</strong>
                  <small>Recibo {p.receiptNumber}, {dateTime(p.paidAt)}, {PAYMENT_METHODS_APP[p.method] ?? p.method}</small>
                  {!p.isReversal && p.status === 'aplicado' && (
                    <small className="p-applied">{[
                      p.appliedLateInterest && `mora ${money(p.appliedLateInterest, cur)}`,
                      p.appliedInterest && `interés ${money(p.appliedInterest, cur)}`,
                      p.appliedPrincipal && `capital ${money(p.appliedPrincipal, cur)}`,
                    ].filter(Boolean).join(', ')}</small>
                  )}
                </div>
                {p.isReversal ? <Badge tone="warn">Corrección</Badge> : p.status === 'reversado' ? <Badge tone="neutral">Anulado</Badge> : <Badge tone="ok">Aplicado</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="p-note">¿Ves algo que no cuadra? Comunícate con {data.company.name} y menciona el número de recibo.</p>
    </div>
  );
}
