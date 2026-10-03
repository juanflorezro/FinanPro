import { Link } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { useAppAuth } from '../AppAuth.jsx';
import { PageHeader, Panel, Loading, ErrorNote, Empty, Button } from '../../components/ui.jsx';
import { money, date, dateTime, relativeDays, number } from '../../utils/format.js';

const BUCKETS = [['0', 'Al día', 'ok'], ['1-30', '1 a 30 días', 'warn'], ['31-60', '31 a 60', 'warn'], ['61-90', '61 a 90', 'bad'], ['90+', 'Más de 90', 'bad']];
const fullName = (b) => (b ? `${b.firstName} ${b.lastName}` : '—');

export default function Home() {
  const { org, can } = useAppAuth();
  const { data, error, loading, reload } = useAppApi('/dashboard');
  const cur = org.currency;

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { portfolio: p, month: m, aging } = data;
  const agingTotal = BUCKETS.reduce((a, [k]) => a + (aging[k]?.balance ?? 0), 0);

  return (
    <>
      <PageHeader title="Inicio" subtitle={`Así va la cartera de ${org.name}.`}
        actions={can('loan.create') && org.status === 'activa' && <Link to="/prestamos/nuevo" className="btn btn-primary">Nuevo préstamo</Link>} />

      <section className="ledger" aria-label="Indicadores de la cartera">
        <div className="ledger-main">
          <span className="ledger-label">Capital por cobrar</span>
          <span className="ledger-figure">{money(p.balancePrincipal, cur)}</span>
          <span className="ledger-note">{number(p.activeLoans)} préstamos activos, {number(p.activeBorrowers)} deudores</span>
        </div>
        <dl className="ledger-cells">
          <div><dt>Cobrado este mes</dt><dd className="dd-money">{money(m.collected, cur)}</dd></div>
          <div><dt>Intereses cobrados este mes</dt><dd className="dd-money">{money(m.collectedInterest, cur)}</dd></div>
          <div><dt>Prestado este mes</dt><dd className="dd-money">{money(m.disbursed, cur)}</dd></div>
          <div><dt>Préstamos en mora</dt><dd className={p.overdueLoans ? 'tone-bad' : ''}>{number(p.overdueLoans)}</dd></div>
          <div><dt>Capital en mora</dt><dd className={`dd-money ${p.overdueBalance ? 'tone-bad' : ''}`}>{money(p.overdueBalance, cur)}</dd></div>
          <div><dt>Intereses vencidos por cobrar</dt><dd className="dd-money">{money(p.interestDue + p.lateInterestDue, cur)}</dd></div>
        </dl>
      </section>

      <Panel title="Antigüedad de la cartera">
        {agingTotal ? (
          <div className="stackbar">
            <div className="stackbar-track" role="img" aria-label="Capital por días de atraso">
              {BUCKETS.filter(([k]) => aging[k]?.balance).map(([k, , tone]) => <span key={k} className={`seg seg-${tone}`} style={{ flexGrow: aging[k].balance }} />)}
            </div>
            <ul className="stackbar-legend">
              {BUCKETS.filter(([k]) => aging[k]).map(([k, label, tone]) => (
                <li key={k}><span className={`dot dot-${tone}`} />{label} <strong>{money(aging[k].balance, cur)}</strong> <span className="muted">({aging[k].count})</span></li>
              ))}
            </ul>
          </div>
        ) : <p className="muted">Cuando desembolses préstamos verás aquí cuánto capital está al día y cuánto atrasado.</p>}
      </Panel>

      <div className="grid-2">
        <Panel title="En mora" flush actions={p.overdueLoans > 0 && <Link to="/prestamos?mora=1" className="btn btn-ghost btn-sm">Ver todos</Link>}>
          {data.overdue.length ? (
            <table className="table table-click">
              <thead><tr><th>Deudor</th><th>Atraso</th><th className="num">Saldo</th></tr></thead>
              <tbody>
                {data.overdue.map((l) => (
                  <tr key={l._id}>
                    <td><Link to={`/prestamos/${l._id}`}>{fullName(l.borrowerId)}</Link><span className="cell-sub">{l.loanNumber}, {l.borrowerId?.phone}</span></td>
                    <td className="tone-bad nowrap">{l.daysPastDue} días</td>
                    <td className="num">{money(l.balancePrincipal + l.balanceInterest + l.balanceLateInterest, l.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty title="Nadie en mora">Los préstamos atrasados aparecen aquí con su teléfono para llamar.</Empty>}
        </Panel>

        <Panel title="Vencen esta semana" flush>
          {data.upcoming.length ? (
            <table className="table">
              <thead><tr><th>Deudor</th><th>Vence</th><th className="num">Cuota</th></tr></thead>
              <tbody>
                {data.upcoming.map((i) => (
                  <tr key={i._id}>
                    <td><Link to={`/prestamos/${i.loanId._id}`}>{fullName(i.loanId.borrowerId)}</Link><span className="cell-sub">{i.loanId.loanNumber}, cuota {i.number}</span></td>
                    <td className="nowrap">{date(i.dueDate)}<span className="cell-sub">{relativeDays(i.dueDate)}</span></td>
                    <td className="num">{money(i.principalDue + i.interestDue + i.feesDue - i.principalPaid - i.interestPaid - i.feesPaid, i.loanId.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty title="Sin cuotas esta semana" />}
        </Panel>
      </div>

      <Panel title="Últimos pagos" flush actions={<Link to="/pagos" className="btn btn-ghost btn-sm">Ver todos</Link>}>
        {data.recentPayments.length ? (
          <table className="table">
            <thead><tr><th>Recibo</th><th>Deudor</th><th>Fecha</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {data.recentPayments.map((pay) => (
                <tr key={pay._id}>
                  <td>{pay.receiptNumber}</td>
                  <td><Link to={`/prestamos/${pay.loanId?._id}`}>{fullName(pay.borrowerId)}</Link><span className="cell-sub">{pay.loanId?.loanNumber}</span></td>
                  <td className="nowrap">{dateTime(pay.paidAt)}</td>
                  <td className={`num ${pay.isReversal ? 'tone-bad' : ''}`}>{money(pay.amount, pay.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty title="Todavía no hay pagos" action={can('loan.create') && <Button variant="secondary" onClick={() => window.location.assign('/prestamos/nuevo')}>Crear el primer préstamo</Button>} />}
      </Panel>
    </>
  );
}
