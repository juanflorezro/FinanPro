import { Link, useNavigate } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { useAppAuth } from '../AppAuth.jsx';
import { PageHeader, Panel, Loading, ErrorNote, Empty, Pagination, Select, StatusBadge, Input } from '../../components/ui.jsx';
import { FilterBar } from '../../components/Filters.jsx';
import { money, date, relativeDays, toCents } from '../../utils/format.js';
import { LOAN_STATUS, AMORTIZATION, FREQUENCY } from '../../utils/labels.js';
import { ExportButton } from '../../components/ExportButton.jsx';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { useDebounced } from '../../utils/useDebounced.js';

const DEFAULTS = { q: '', estado: '', mora: '', minDpd: '', tipo: '', forma: '', frecuencia: '', min: '', max: '', desde: '', hasta: '', venceDesde: '', venceHasta: '', orden: 'recientes' };
const SORTS = { recientes: 'Más recientes', antiguos: 'Más antiguos', mora: 'Más días de atraso', saldo: 'Mayor saldo', proxima: 'Próxima cuota' };
const labelsOf = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

export default function Loans() {
  const navigate = useNavigate();
  const { can, org } = useAppAuth();
  const F = useUrlFilters(DEFAULTS);
  const v = F.values;
  const q = useDebounced(v.q, 300);

  const query = {
    q, status: v.estado, overdue: v.mora === '1' ? 'true' : undefined, minDpd: v.minDpd, lendingRegime: v.tipo, amortization: v.forma,
    frequency: v.frecuencia, minPrincipal: v.min && toCents(v.min), maxPrincipal: v.max && toCents(v.max),
    from: v.desde, to: v.hasta, dueFrom: v.venceDesde, dueTo: v.venceHasta, sort: v.orden,
  };
  const { data, error, loading, reload } = useAppApi('/loans', { ...query, page: F.page, limit: F.limit });
  const set = (k) => (e) => F.set(k, e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value);

  const chips = [
    v.estado && { label: `Estado: ${LOAN_STATUS[v.estado]?.[0]}`, onClear: () => F.set('estado', '') },
    v.mora && { label: 'Con atraso', onClear: () => F.set('mora', '') },
    v.minDpd && { label: `Atraso ≥ ${v.minDpd} días`, onClear: () => F.set('minDpd', '') },
    v.tipo && { label: v.tipo === 'formal' ? 'Formales' : 'Informales', onClear: () => F.set('tipo', '') },
    v.forma && { label: AMORTIZATION[v.forma]?.[0], onClear: () => F.set('forma', '') },
    v.frecuencia && { label: FREQUENCY[v.frecuencia], onClear: () => F.set('frecuencia', '') },
    (v.min || v.max) && { label: `Capital ${v.min ? `desde ${money(toCents(v.min))}` : ''} ${v.max ? `hasta ${money(toCents(v.max))}` : ''}`, onClear: () => F.update({ min: '', max: '' }) },
    (v.desde || v.hasta) && { label: `Desembolso ${v.desde || '…'} a ${v.hasta || '…'}`, onClear: () => F.update({ desde: '', hasta: '' }) },
    (v.venceDesde || v.venceHasta) && { label: `Próxima cuota ${v.venceDesde || '…'} a ${v.venceHasta || '…'}`, onClear: () => F.update({ venceDesde: '', venceHasta: '' }) },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Préstamos" subtitle="Cada préstamo con su tasa, sus cuotas y su saldo."
        actions={<><ExportButton path="/exports/loans.xlsx" query={query} />{can('loan.create') && org.status === 'activa' && <Link to="/prestamos/nuevo" className="btn btn-primary">Nuevo préstamo</Link>}</>} />
      <Panel flush>
        <FilterBar
          search={v.q} onSearch={(x) => F.set('q', x)} placeholder="Número, deudor, documento o celular"
          quick={<>
            <Select aria-label="Estado" value={v.estado} onChange={set('estado')} options={labelsOf(LOAN_STATUS)} placeholder="Todos los estados" />
            <label className="check"><input type="checkbox" checked={v.mora === '1'} onChange={set('mora')} /> Solo con atraso</label>
          </>}
          sort={<Select aria-label="Ordenar" value={v.orden} onChange={set('orden')} options={SORTS} />}
          advanced={<>
            <Input label="Atraso mínimo (días)" type="number" min="0" value={v.minDpd} onChange={set('minDpd')} />
            <Select label="Tipo" value={v.tipo} onChange={set('tipo')} options={{ formal: 'Formal', informal: 'Informal' }} placeholder="Todos" />
            <Select label="Forma de pago" value={v.forma} onChange={set('forma')} options={labelsOf(AMORTIZATION)} placeholder="Todas" />
            <Select label="Frecuencia" value={v.frecuencia} onChange={set('frecuencia')} options={FREQUENCY} placeholder="Todas" />
            <div className="range"><span>Capital prestado</span>
              <Input aria-label="Capital desde" placeholder="Desde" inputMode="numeric" value={v.min} onChange={set('min')} />
              <Input aria-label="Capital hasta" placeholder="Hasta" inputMode="numeric" value={v.max} onChange={set('max')} />
            </div>
            <div className="range"><span>Fecha de desembolso</span>
              <Input aria-label="Desembolso desde" type="date" value={v.desde} onChange={set('desde')} />
              <Input aria-label="Desembolso hasta" type="date" value={v.hasta} onChange={set('hasta')} />
            </div>
            <div className="range"><span>Próxima cuota</span>
              <Input aria-label="Próxima cuota desde" type="date" value={v.venceDesde} onChange={set('venceDesde')} />
              <Input aria-label="Próxima cuota hasta" type="date" value={v.venceHasta} onChange={set('venceHasta')} />
            </div>
          </>}
          chips={chips} onReset={F.reset}
        />
        {loading && !data ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !data?.items?.length ? (
          <Empty title={F.active ? 'Ningún préstamo con esos filtros' : 'Todavía no hay préstamos'}>{F.active ? 'Prueba quitando algún filtro.' : 'Crea el primero desde la ficha de un deudor o con el botón Nuevo préstamo.'}</Empty>
        ) : (
          <div className={loading ? 'is-refreshing' : ''}>
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
            <Pagination page={F.page} limit={F.limit} total={data.total} onPage={F.setPage} onLimit={F.setLimit} />
          </div>
        )}
      </Panel>
    </>
  );
}
