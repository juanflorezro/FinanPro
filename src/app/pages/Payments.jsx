import { Link } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { useAppAuth } from '../AppAuth.jsx';
import { PageHeader, Panel, Loading, ErrorNote, Empty, Pagination, Input, Select, Badge } from '../../components/ui.jsx';
import { FilterBar } from '../../components/Filters.jsx';
import { money, dateTime, toCents, inputDate } from '../../utils/format.js';
import { PAYMENT_METHODS_APP } from '../../utils/labels.js';
import { ExportButton } from '../../components/ExportButton.jsx';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { useDebounced } from '../../utils/useDebounced.js';

const DEFAULTS = { q: '', desde: '', hasta: '', caja: '', medio: '', canal: '', tipo: '', min: '', max: '', orden: 'recientes' };
const KINDS = { aplicados: 'Aplicados', reversados: 'Reversados', reversos: 'Movimientos de reverso' };
const SORTS = { recientes: 'Más recientes', antiguos: 'Más antiguos', mayor: 'Mayor valor', menor: 'Menor valor' };

const today = () => inputDate(new Date());
const daysAgo = (n) => inputDate(new Date(Date.now() - n * 86_400_000));
const monthStart = () => { const d = new Date(); return inputDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1))); };

export default function Payments() {
  const { can } = useAppAuth();
  const F = useUrlFilters(DEFAULTS, { limit: 25 });
  const v = F.values;
  const q = useDebounced(v.q, 300);
  const cash = useAppApi(can('cash.read') ? '/cash-accounts' : null);
  const cashMap = Object.fromEntries((cash.data ?? []).map((c) => [c._id, c.name]));

  const query = {
    q, from: v.desde, to: v.hasta, cashAccountId: v.caja, method: v.medio, channel: v.canal, kind: v.tipo,
    minAmount: v.min && toCents(v.min), maxAmount: v.max && toCents(v.max), sort: v.orden,
  };
  const { data, error, loading, reload } = useAppApi('/payments', { ...query, page: F.page, limit: F.limit });
  const set = (k) => (e) => F.set(k, e.target.value);

  const presets = { hoy: [today(), today()], '7': [daysAgo(6), today()], '30': [daysAgo(29), today()], mes: [monthStart(), today()] };
  const preset = Object.entries(presets).find(([, [a, b]]) => a === v.desde && b === v.hasta)?.[0] ?? (v.desde || v.hasta ? 'rango' : '');

  const chips = [
    (v.desde || v.hasta) && { label: `Fecha ${v.desde || '…'} a ${v.hasta || '…'}`, onClear: () => F.update({ desde: '', hasta: '' }) },
    v.caja && { label: `Caja: ${cashMap[v.caja] ?? '…'}`, onClear: () => F.set('caja', '') },
    v.medio && { label: PAYMENT_METHODS_APP[v.medio], onClear: () => F.set('medio', '') },
    v.canal && { label: `Canal: ${v.canal}`, onClear: () => F.set('canal', '') },
    v.tipo && { label: KINDS[v.tipo], onClear: () => F.set('tipo', '') },
    (v.min || v.max) && { label: `Valor ${v.min ? `desde ${money(toCents(v.min))}` : ''} ${v.max ? `hasta ${money(toCents(v.max))}` : ''}`, onClear: () => F.update({ min: '', max: '' }) },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Pagos" subtitle="Todo lo que han pagado tus deudores, con su recibo."
        actions={<ExportButton path="/exports/payments.xlsx" query={query} />} />
      <Panel flush>
        <FilterBar
          search={v.q} onSearch={(x) => F.set('q', x)} placeholder="Recibo, referencia, deudor o documento"
          quick={<Select aria-label="Periodo" value={preset} onChange={(e) => { const p = presets[e.target.value]; F.update(p ? { desde: p[0], hasta: p[1] } : { desde: '', hasta: '' }); }}
            options={{ hoy: 'Hoy', '7': 'Últimos 7 días', '30': 'Últimos 30 días', mes: 'Este mes', ...(preset === 'rango' && { rango: 'Rango personalizado' }) }} placeholder="Cualquier fecha" />}
          sort={<Select aria-label="Ordenar" value={v.orden} onChange={set('orden')} options={SORTS} />}
          advanced={<>
            <div className="range"><span>Rango de fechas</span>
              <Input aria-label="Desde" type="date" value={v.desde} onChange={set('desde')} />
              <Input aria-label="Hasta" type="date" value={v.hasta} onChange={set('hasta')} />
            </div>
            {Object.keys(cashMap).length > 0 && <Select label="Caja" value={v.caja} onChange={set('caja')} options={cashMap} placeholder="Todas" />}
            <Select label="Medio" value={v.medio} onChange={set('medio')} options={PAYMENT_METHODS_APP} placeholder="Todos" />
            <Select label="Canal" value={v.canal} onChange={set('canal')} options={{ oficina: 'Oficina', cobrador: 'Cobrador', portal: 'Portal' }} placeholder="Todos" />
            <Select label="Tipo" value={v.tipo} onChange={set('tipo')} options={KINDS} placeholder="Todos" />
            <div className="range"><span>Valor</span>
              <Input aria-label="Valor desde" placeholder="Desde" inputMode="numeric" value={v.min} onChange={set('min')} />
              <Input aria-label="Valor hasta" placeholder="Hasta" inputMode="numeric" value={v.max} onChange={set('max')} />
            </div>
          </>}
          chips={chips} onReset={F.reset}
        />
        {loading && !data ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !data?.items?.length ? <Empty title={F.active ? 'Ningún pago con esos filtros' : 'Todavía no hay pagos'} /> : (
          <div className={loading ? 'is-refreshing' : ''}>
            <p className="result-sum">{data.total.toLocaleString('es-CO')} pagos encontrados, suman <strong>{money(data.sumAmount, data.items[0]?.currency)}</strong></p>
            <table className="table">
              <thead><tr><th>Recibo</th><th>Fecha</th><th>Deudor</th><th>Préstamo</th><th>Medio</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id}>
                    <td>{p.receiptNumber}{p.isReversal && <> <Badge tone="warn">Reverso</Badge></>}{p.status === 'reversado' && <> <Badge tone="neutral">Reversado</Badge></>}</td>
                    <td className="nowrap">{dateTime(p.paidAt)}</td>
                    <td>{p.borrowerId ? `${p.borrowerId.firstName} ${p.borrowerId.lastName}` : '—'}</td>
                    <td>{p.loanId ? <Link to={`/prestamos/${p.loanId._id}`}>{p.loanId.loanNumber}</Link> : '—'}</td>
                    <td>{PAYMENT_METHODS_APP[p.method]}<span className="cell-sub">{p.cashAccountId?.name}</span></td>
                    <td className={`num ${p.amount < 0 ? 'tone-bad' : ''}`}>{money(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={F.page} limit={F.limit} total={data.total} onPage={F.setPage} onLimit={F.setLimit} />
          </div>
        )}
      </Panel>
    </>
  );
}
