import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { useAction } from '../../components/useAction.js';
import { PageHeader, Panel, Loading, ErrorNote, Empty, Select, Badge, DefList, Pagination } from '../../components/ui.jsx';
import { ChatThread } from '../../components/ChatThread.jsx';
import { usePolling } from '../../components/usePolling.js';
import { dateTime } from '../../utils/format.js';

const TYPES = { chat: 'Chat general', falla: 'Falla', eliminar_credito: 'Eliminar crédito', ajuste_pago: 'Corregir pago', consulta: 'Consulta', otro: 'Otro' };
const STATUS = { abierto: ['Abierta', 'info'], en_progreso: ['En progreso', 'warn'], esperando_cliente: ['Esperando cliente', 'neutral'], resuelto: ['Resuelta', 'ok'], cerrado: ['Cerrada', 'neutral'] };
const PRIORITY = { baja: ['Baja', 'neutral'], media: ['Media', 'info'], alta: ['Alta', 'warn'], critica: ['Crítica', 'bad'] };
const POLL = 10_000;

function TicketView({ id, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { run } = useAction();
  const load = useCallback(() => api(`/admin/support/tickets/${id}`).then((d) => { setData(d); setError(null); }).catch(setError), [id]);
  usePolling(load, POLL, [load]);

  if (error) return <ErrorNote error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const { ticket: t, messages, admins, relatedLoan } = data;
  const update = async (body, msg) => { if (await run(() => api(`/admin/support/tickets/${id}`, { method: 'PATCH', body }), msg)) { load(); onChanged(); } };

  return (
    <div className="desk-ticket">
      <Panel flush className="thread-panel">
        <header className="thread-head">
          <div className="thread-title">
            <h2>{t.type === 'chat' ? `Chat con ${t.orgId?.name}` : t.subject}</h2>
            <span className="muted small">#{t.number}, {TYPES[t.type]}, <Link to={`/admin/organizaciones/${t.orgId?._id}`}>{t.orgId?.name}</Link></span>
          </div>
        </header>
        <ChatThread side="admin" allowInternal messages={messages}
          placeholder="Responde al cliente o deja una nota interna"
          onSend={async (body, internal) => { await api(`/admin/support/tickets/${id}/messages`, { method: 'POST', body: { body, internal } }); await load(); onChanged(); }} />
      </Panel>
      <div className="stack">
        <Panel title="Gestión">
          <div className="form-grid single">
            <Select label="Responsable" value={t.assignedAdminId?._id ?? ''} placeholder="Sin asignar" onChange={(e) => update({ assignedAdminId: e.target.value || null }, 'Responsable actualizado')}
              options={Object.fromEntries(admins.map((a) => [a._id, a.name]))} hint="Le llega un correo al asignarla" />
            {t.type !== 'chat' && <Select label="Estado" value={t.status} onChange={(e) => update({ status: e.target.value }, 'Estado actualizado')} options={Object.fromEntries(Object.entries(STATUS).map(([k, [v]]) => [k, v]))} />}
            <Select label="Prioridad" value={t.priority} onChange={(e) => update({ priority: e.target.value }, 'Prioridad actualizada')} options={Object.fromEntries(Object.entries(PRIORITY).map(([k, [v]]) => [k, v]))} />
          </div>
        </Panel>
        <Panel title="Detalles">
          <DefList items={[
            ['Empresa', <Link key="o" to={`/admin/organizaciones/${t.orgId?._id}`}>{t.orgId?.name}</Link>],
            ['Abrió', t.openedBy ? `${t.openedBy.name ?? ''} ${t.openedBy.email}` : '—'],
            ['Creada', dateTime(t.createdAt)],
            relatedLoan && ['Crédito', <span key="l">{relatedLoan.loanNumber} {relatedLoan.deletedAt ? <Badge tone="bad">Eliminado</Badge> : null}</span>],
          ]} />
          {relatedLoan && !relatedLoan.deletedAt && t.type === 'eliminar_credito' && (
            <p className="field-hint section-gap">Para eliminarlo, ve a la organización, abre acceso de soporte con permiso de escritura y usa "Eliminar para el cliente" en el crédito. Indica el ticket #{t.number}.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function SupportDesk() {
  const { admin } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const selected = params.get('t');
  const [filters, setFilters] = useState({ status: 'abiertas', assigned: '', type: '' });
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => api('/admin/support/tickets', { query: { ...filters, page, limit: 25 } }).then((d) => { setList(d); setError(null); }).catch(setError), [filters, page]);
  usePolling(load, POLL, [load]);
  const set = (k) => (e) => { setFilters({ ...filters, [k]: e.target.value }); setPage(1); };

  return (
    <>
      <PageHeader title="Mesa de ayuda" subtitle={`Chats y solicitudes de los clientes. ${admin.name}, las asignadas a ti te llegan por correo.`} />
      <div className={`desk ${selected ? 'has-selection' : ''}`}>
        <Panel flush className="desk-list">
          <div className="toolbar">
            <Select aria-label="Estado" value={filters.status} onChange={set('status')} options={{ abiertas: 'Abiertas', ...Object.fromEntries(Object.entries(STATUS).map(([k, [v]]) => [k, v])) }} placeholder="Todas" />
            <Select aria-label="Responsable" value={filters.assigned} onChange={set('assigned')} options={{ me: 'Asignadas a mí', none: 'Sin asignar' }} placeholder="Todos" />
            <Select aria-label="Tipo" value={filters.type} onChange={set('type')} options={TYPES} placeholder="Todos los tipos" />
          </div>
          {error ? <ErrorNote error={error} onRetry={load} /> : !list ? <Loading /> : list.items.length === 0 ? <Empty title="No hay solicitudes con estos filtros" /> : (
            <>
              <ul className="ticket-list">
                {list.items.map((t) => (
                  <li key={t._id} className={selected === t._id ? 'selected' : ''}>
                    <button type="button" onClick={() => setParams({ t: t._id })}>
                      <span className="ticket-main">
                        <strong>{t.type === 'chat' ? `Chat: ${t.orgId?.name}` : t.subject}</strong>
                        <span className="muted small">#{t.number}, {t.orgId?.name}, {TYPES[t.type]}</span>
                        {t.lastMessagePreview && <span className="ticket-preview">{t.lastMessagePreview}</span>}
                      </span>
                      <span className="ticket-side">
                        {t.type !== 'chat' && <Badge tone={STATUS[t.status][1]}>{STATUS[t.status][0]}</Badge>}
                        {['alta', 'critica'].includes(t.priority) && <Badge tone={PRIORITY[t.priority][1]}>{PRIORITY[t.priority][0]}</Badge>}
                        <span className="muted small">{t.assignedAdminId?.name ?? 'Sin asignar'}</span>
                        {t.unreadForAdmin > 0 && <span className="count-badge">{t.unreadForAdmin}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={page} limit={25} total={list.total} onPage={setPage} />
            </>
          )}
        </Panel>
        <div className="desk-detail">
          {selected ? (
            <>
              <button type="button" className="back desk-back" onClick={() => setParams({})}>Volver a la lista</button>
              <TicketView key={selected} id={selected} onChanged={load} />
            </>
          ) : <Panel><Empty title="Elige una solicitud">Las que tienen mensajes sin leer aparecen primero.</Empty></Panel>}
        </div>
      </div>
    </>
  );
}
