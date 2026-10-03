import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { useAppAuth } from '../AppAuth.jsx';
import { PageHeader, Panel, Loading, ErrorNote, Empty, Pagination, Select, StatusBadge } from '../../components/ui.jsx';
import { money, date, relativeDays } from '../../utils/format.js';
import { LOAN_STATUS, AMORTIZATION } from '../../utils/labels.js';

export default function Loans() {
  const navigate = useNavigate();
  const { can, org } = useAppAuth();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const status = params.get('estado') ?? '';
  const overdue = params.get('mora') === '1';
  const { data, error, loading, reload } = useAppApi('/loans', { status, overdue: overdue ? 'true' : undefined, page, limit: 20 });

  const setFilter = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p); setPage(1); };

  return (
    <>
      <PageHeader title="Préstamos" subtitle="Cada préstamo con su tasa, sus cuotas y su saldo."
        actions={can('loan.create') && org.status === 'activa' && <Link to="/prestamos/nuevo" className="btn btn-primary">Nuevo préstamo</Link>} />
      <Panel flush>
        <div className="toolbar">
          <Select aria-label="Estado" value={status} onChange={(e) => setFilter('estado', e.target.value)} options={Object.fromEntries(Object.entries(LOAN_STATUS).map(([k, [t]]) => [k, t]))} placeholder="Todos los estados" />
          <label className="check"><input type="checkbox" checked={overdue} onChange={(e) => setFilter('mora', e.target.checked ? '1' : '')} /> Solo con atraso</label>
        </div>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : data.items.length === 0 ? (
          <Empty title={status || overdue ? 'Ningún préstamo con esos filtros' : 'Todavía no hay préstamos'}>{!status && !overdue && 'Crea el primero desde la ficha de un deudor o con el botón Nuevo préstamo.'}</Empty>
        ) : (
          <>
            <table className="table table-click">
              <thead><tr><th>Préstamo</th><th>Deudor</th><th className="num">Capital</th><th className="num">Saldo</th><th>Próxima cuota</th><th>Estado</th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l._id} onClick={() => navigate(`/prestamos/${l._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/prestamos/${l._id}`)}>
                    <td><strong>{l.loanNumber}</strong><span className="cell-sub">{l.rate}% {l.rateBasis}, {AMORTIZATION[l.amortization]?.[0].toLowerCase()}</span></td>
                    <td>{l.borrowerId?.firstName} {l.borrowerId?.lastName}<span className="cell-sub">{l.borrowerId?.docNumber}</span></td>
                    <td className="num">{money(l.principal, l.currency)}</td>
                    <td className="num">{money(l.balancePrincipal, l.currency)}</td>
                    <td className="nowrap">{l.nextDueDate ? <>{date(l.nextDueDate)}<span className="cell-sub">{money(l.nextDueAmount, l.currency)}, {relativeDays(l.nextDueDate)}</span></> : '—'}</td>
                    <td><StatusBadge map={LOAN_STATUS} value={l.status} />{l.daysPastDue > 0 && <span className="cell-sub tone-bad">{l.daysPastDue} días</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} limit={20} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
