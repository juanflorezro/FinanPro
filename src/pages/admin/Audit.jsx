import { Fragment, useState } from 'react';
import { useApi } from '../../api/useApi.js';
import { PageHeader, Panel, Loading, ErrorNote, Empty, Pagination, Select, Input } from '../../components/ui.jsx';
import { dateTime } from '../../utils/format.js';
import { ACTIONS } from '../../utils/labels.js';

const ACTOR = { platform_admin: 'Administrador', user: 'Usuario de empresa', borrower: 'Deudor', system: 'Sistema' };

export default function Audit() {
  const [filters, setFilters] = useState({ action: '', actorType: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, error, loading, reload } = useApi('/admin/audit', { ...filters, page, limit: 30 });
  const set = (k) => (e) => { setFilters({ ...filters, [k]: e.target.value }); setPage(1); };

  return (
    <>
      <PageHeader title="Bitácora" subtitle="Todo lo que hace el equipo de la plataforma queda aquí. No se puede editar ni borrar." />
      <Panel flush>
        <div className="toolbar">
          <Select aria-label="Acción" value={filters.action} onChange={set('action')} options={ACTIONS} placeholder="Todas las acciones" />
          <Select aria-label="Quién" value={filters.actorType} onChange={set('actorType')} options={ACTOR} placeholder="Cualquier actor" />
          <Input aria-label="Desde" type="date" value={filters.from} onChange={set('from')} />
          <Input aria-label="Hasta" type="date" value={filters.to} onChange={set('to')} />
        </div>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : data.items.length === 0 ? <Empty title="Sin registros para estos filtros" /> : (
          <>
            <table className="table table-click">
              <thead><tr><th>Fecha</th><th>Quién</th><th>Qué hizo</th><th>Registro</th></tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <Fragment key={r._id}>
                    <tr onClick={() => setOpen(open === r._id ? null : r._id)} tabIndex={0} aria-expanded={open === r._id} onKeyDown={(e) => e.key === 'Enter' && setOpen(open === r._id ? null : r._id)}>
                      <td>{dateTime(r.at)}</td>
                      <td>{r.actorEmail ?? ACTOR[r.actorType]}<span className="cell-sub">{ACTOR[r.actorType]}{r.supportGrantId ? ', en soporte' : ''}</span></td>
                      <td>{ACTIONS[r.action] ?? r.action}</td>
                      <td>{r.entity ?? '—'}<span className="cell-sub mono-id">{r.entityId}</span></td>
                    </tr>
                    {open === r._id && (
                      <tr className="row-detail">
                        <td colSpan={4}>
                          <div className="diff">
                            {r.before && <div><span className="muted small">Antes</span><pre>{JSON.stringify(r.before, null, 2)}</pre></div>}
                            {r.after && <div><span className="muted small">Después</span><pre>{JSON.stringify(r.after, null, 2)}</pre></div>}
                            {!r.before && !r.after && <span className="muted">Sin detalle adicional. IP {r.ip ?? 'desconocida'}.</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <Pagination page={page} limit={30} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
