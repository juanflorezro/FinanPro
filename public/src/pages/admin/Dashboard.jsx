import { Link } from 'react-router-dom';
import { useApi } from '../../api/useApi.js';
import { PageHeader, Panel, Loading, ErrorNote, StatusBadge, Empty } from '../../components/ui.jsx';
import { money, date, relativeDays, number } from '../../utils/format.js';
import { SUB_STATUS, PAY_METHODS } from '../../utils/labels.js';

const sumMoney = (obj) => Object.entries(obj ?? {}).map(([cur, v]) => money(typeof v === 'number' ? v : v.total, cur));

function SubscriptionBar({ counts }) {
  const order = ['activa', 'prueba', 'en_gracia', 'vencida', 'cancelada'];
  const total = order.reduce((a, k) => a + (counts?.[k] ?? 0), 0);
  if (!total) return <p className="muted small">Todavía no hay suscripciones.</p>;
  return (
    <div className="stackbar">
      <div className="stackbar-track" role="img" aria-label="Distribución de suscripciones por estado">
        {order.filter((k) => counts[k]).map((k) => (
          <span key={k} className={`seg seg-${SUB_STATUS[k][1]}`} style={{ flexGrow: counts[k] }} />
        ))}
      </div>
      <ul className="stackbar-legend">
        {order.filter((k) => counts[k]).map((k) => (
          <li key={k}><span className={`dot dot-${SUB_STATUS[k][1]}`} />{SUB_STATUS[k][0]} <strong>{counts[k]}</strong></li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useApi('/admin/dashboard');

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const mrr = sumMoney(data.mrr);
  const month = data.monthRevenue?.length ? data.monthRevenue.map((r) => money(r.total, r._id)) : [money(0)];
  const t = data.tenants ?? {};
  const o = data.organizations ?? {};

  return (
    <>
      <PageHeader title="Resumen" subtitle="Cómo va la plataforma hoy." />

      <section className="ledger" aria-label="Indicadores principales">
        <div className="ledger-main">
          <span className="ledger-label">Ingreso mensual recurrente</span>
          <span className="ledger-figure">{mrr.length ? mrr.join(' + ') : money(0)}</span>
          <span className="ledger-note">Cobrado este mes: {month.join(' + ')}</span>
        </div>
        <dl className="ledger-cells">
          <div><dt>Clientes activos</dt><dd>{number(t.activo ?? 0)}</dd></div>
          <div><dt>Por habilitar</dt><dd>{number((t.prospecto ?? 0) + (t.pendiente_pago ?? 0))}</dd></div>
          <div><dt>Sin crear su organización</dt><dd>{number(t.habilitado ?? 0)}</dd></div>
          <div><dt>Organizaciones activas</dt><dd>{number(o.activa ?? 0)}</dd></div>
          <div><dt>En solo lectura</dt><dd className={o.solo_lectura ? 'tone-warn' : ''}>{number(o.solo_lectura ?? 0)}</dd></div>
          <div><dt>Suspendidas</dt><dd className={o.suspendida ? 'tone-bad' : ''}>{number(o.suspendida ?? 0)}</dd></div>
        </dl>
      </section>

      <Panel title="Suscripciones">
        <SubscriptionBar counts={data.subscriptions} />
      </Panel>

      <div className="grid-2">
        <Panel title="Vencen en los próximos 7 días" flush>
          {data.expiring.length ? (
            <table className="table">
              <thead><tr><th>Cliente</th><th>Plan</th><th>Vence</th><th>Estado</th></tr></thead>
              <tbody>
                {data.expiring.map((s) => (
                  <tr key={s._id}>
                    <td><Link to={`/admin/clientes/${s.tenantAccountId?._id}`}>{s.tenantAccountId?.legalName}</Link><span className="cell-sub">{s.tenantAccountId?.contactPhone ?? s.tenantAccountId?.contactEmail}</span></td>
                    <td>{s.planId?.name}</td>
                    <td className="nowrap">{date(s.currentPeriodEnd)}<span className="cell-sub">{relativeDays(s.currentPeriodEnd)}</span></td>
                    <td><StatusBadge map={SUB_STATUS} value={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty title="Nada por vencer esta semana" />}
        </Panel>

        <Panel title="Últimos pagos recibidos" flush>
          {data.recentPayments.length ? (
            <table className="table">
              <thead><tr><th>Cliente</th><th>Fecha</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {data.recentPayments.map((p) => (
                  <tr key={p._id}>
                    <td><Link to={`/admin/clientes/${p.tenantAccountId?._id}`}>{p.tenantAccountId?.legalName}</Link><span className="cell-sub">{PAY_METHODS[p.method]}</span></td>
                    <td className="nowrap">{date(p.paidAt)}</td>
                    <td className="num">{money(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty title="Aún no hay pagos">Los pagos que registres en cada cliente aparecen aquí.</Empty>}
        </Panel>
      </div>
    </>
  );
}
