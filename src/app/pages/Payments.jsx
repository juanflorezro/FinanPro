import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { useAppAuth } from '../AppAuth.jsx';
import { PageHeader, Panel, Loading, ErrorNote, Empty, Pagination, Input, Select, Badge } from '../../components/ui.jsx';
import { money, dateTime } from '../../utils/format.js';
import { PAYMENT_METHODS_APP } from '../../utils/labels.js';

export default function Payments() {
  const { can } = useAppAuth();
  const [f, setF] = useState({ from: '', to: '', cashAccountId: '' });
  const [page, setPage] = useState(1);
  const cash = useAppApi(can('cash.read') ? '/cash-accounts' : null);
  const { data, error, loading, reload } = useAppApi('/payments', {
    ...f, from: f.from && `${f.from}T00:00:00`, to: f.to && `${f.to}T23:59:59`, page, limit: 25,
  });
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const total = data?.items?.reduce((a, p) => a + p.amount, 0) ?? 0;

  return (
    <>
      <PageHeader title="Pagos" subtitle="Todo lo que han pagado tus deudores, con su recibo." />
      <Panel flush>
        <div className="toolbar">
          <Input aria-label="Desde" type="date" value={f.from} onChange={set('from')} />
          <Input aria-label="Hasta" type="date" value={f.to} onChange={set('to')} />
          {cash.data?.length > 1 && <Select aria-label="Caja" value={f.cashAccountId} onChange={set('cashAccountId')} options={Object.fromEntries(cash.data.map((c) => [c._id, c.name]))} placeholder="Todas las cajas" />}
        </div>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : data.items.length === 0 ? <Empty title="Sin pagos en este rango" /> : (
          <>
            <table className="table">
              <thead><tr><th>Recibo</th><th>Fecha</th><th>Deudor</th><th>Préstamo</th><th>Medio</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id}>
                    <td>{p.receiptNumber}{p.isReversal && <> <Badge tone="warn">Reverso</Badge></>}{p.status === 'reversado' && <> <Badge tone="neutral">Reversado</Badge></>}</td>
                    <td className="nowrap">{dateTime(p.paidAt)}</td>
                    <td>{p.borrowerId ? `${p.borrowerId.firstName} ${p.borrowerId.lastName}` : '—'}</td>
                    <td>{p.loanId ? <Link to={`/prestamos/${p.loanId._id}`}>{p.loanId.loanNumber}</Link> : '—'}</td>
                    <td>{PAYMENT_METHODS_APP[p.method]}</td>
                    <td className={`num ${p.amount < 0 ? 'tone-bad' : ''}`}>{money(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5} className="muted">Total de esta página</td><td className="num"><strong>{money(total, data.items[0]?.currency)}</strong></td></tr></tfoot>
            </table>
            <Pagination page={page} limit={25} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
