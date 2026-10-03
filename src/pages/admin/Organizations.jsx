import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../api/useApi.js';
import { PageHeader, Panel, Loading, ErrorNote, StatusBadge, Empty, Pagination, SearchInput, Select, Badge } from '../../components/ui.jsx';
import { date } from '../../utils/format.js';
import { ORG_STATUS, SUB_STATUS } from '../../utils/labels.js';
import { useDebounced } from '../../utils/useDebounced.js';

export function ComplianceBadge({ compliance }) {
  if (!compliance?.enabled) return <Badge tone="neutral">Tasa libre</Badge>;
  return <Badge tone="info">{compliance.policy === 'bloquear' ? 'Acogida a la ley' : 'Acogida, con aviso'}</Badge>;
}

export default function Organizations() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q, 300);
  const { data, error, loading, reload } = useApi('/admin/organizations', { q: search, status, page, limit: 20 });

  return (
    <>
      <PageHeader title="Organizaciones" subtitle="Cada empresa operando en la plataforma, con sus datos aislados." />
      <Panel flush>
        <div className="toolbar">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nombre o NIT" />
          <Select aria-label="Estado" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={Object.fromEntries(Object.entries(ORG_STATUS).map(([k, [t]]) => [k, t]))} placeholder="Todos los estados" />
        </div>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !data?.items?.length ? (
          <Empty title={search || status ? 'Ninguna organización coincide' : 'Todavía no hay organizaciones'}>
            {!search && !status && 'Aparecen cuando un cliente habilitado entra y crea la suya.'}
          </Empty>
        ) : (
          <>
            <table className="table table-click">
              <thead><tr><th>Organización</th><th>Dueño</th><th>Plan</th><th>Tasa de interés</th><th>Estado</th><th>Creada</th></tr></thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o._id} onClick={() => navigate(`/admin/organizaciones/${o._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/organizaciones/${o._id}`)}>
                    <td><strong>{o.name}</strong><span className="cell-sub">{o.tenantAccountId?.legalName}</span></td>
                    <td>{o.ownerUserId?.email ?? '—'}</td>
                    <td>{o.subscription ? <>{o.subscription.planId?.name}<span className="cell-sub"><StatusBadge map={SUB_STATUS} value={o.subscription.status} /></span></> : '—'}</td>
                    <td><ComplianceBadge compliance={o.settings?.legalRateCompliance} /></td>
                    <td><StatusBadge map={ORG_STATUS} value={o.status} /></td>
                    <td>{date(o.createdAt)}</td>
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
