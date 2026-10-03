import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { appApi } from '../../api/appClient.js';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Modal, Input, Select, Textarea, Badge, FormErrors, SearchInput } from '../../components/ui.jsx';
import { ChatThread } from '../../components/ChatThread.jsx';
import { dateTime } from '../../utils/format.js';
import { rules, validate, focusFirstError } from '../../utils/validation.js';
import { usePolling } from '../../components/usePolling.js';

export const TICKET_TYPES = {
  falla: 'Algo no funciona', eliminar_credito: 'Eliminar un crédito', ajuste_pago: 'Corregir un pago', consulta: 'Tengo una pregunta', otro: 'Otro',
};
export const TICKET_STATUS = {
  abierto: ['Abierta', 'info'], en_progreso: ['En revisión', 'warn'], esperando_cliente: ['Esperando tu respuesta', 'warn'], resuelto: ['Resuelta', 'ok'], cerrado: ['Cerrada', 'neutral'],
};
const POLL_MS = 10_000;

function Thread({ path, sendPath, onBack, closable, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { run, busy } = useAppAction();
  const load = useCallback(() => appApi(path).then((d) => { setData(d); setError(null); }).catch(setError), [path]);
  usePolling(load, POLL_MS, [path]);

  if (error) return <ErrorNote error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const t = data.ticket;
  const closed = t.status === 'cerrado';
  return (
    <Panel flush className="thread-panel">
      <header className="thread-head">
        {onBack && <button type="button" className="back" onClick={onBack}>Solicitudes</button>}
        <div className="thread-title">
          <h2>{t.type === 'chat' ? 'Chat con soporte' : t.subject}</h2>
          {t.type !== 'chat' && <span className="muted small">#{t.number}{t.relatedLoanId?.loanNumber ? `, crédito ${t.relatedLoanId.loanNumber}` : ''} <Badge tone={TICKET_STATUS[t.status][1]}>{TICKET_STATUS[t.status][0]}</Badge></span>}
          {t.type === 'chat' && <span className="muted small">Te respondemos aquí. Si es algo puntual, crea una solicitud.</span>}
        </div>
        {closable && !closed && <Button variant="ghost" size="sm" loading={busy} onClick={async () => { const r = await run(() => appApi(`/support/tickets/${t._id}/close`, { method: 'POST' }), 'Solicitud cerrada'); if (r.ok) { load(); onChanged?.(); } }}>Cerrar solicitud</Button>}
      </header>
      <ChatThread
        side="user"
        messages={data.messages}
        disabled={closed}
        placeholder={t.type === 'chat' ? 'Escribe tu mensaje a soporte' : 'Agrega información o responde'}
        onSend={async (body) => { await appApi(sendPath(t), { method: 'POST', body: { body } }); await load(); onChanged?.(); }}
      />
    </Panel>
  );
}

export default function Support() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('t') ? 'solicitudes' : params.get('nuevo') ? 'solicitudes' : 'chat');
  const [open, setOpen] = useState(params.get('t'));
  const [list, setList] = useState(null);
  const [listError, setListError] = useState(null);
  const [creating, setCreating] = useState(Boolean(params.get('nuevo')));
  const loanId = params.get('prestamo');
  const [form, setForm] = useState({
    type: loanId ? 'eliminar_credito' : 'falla',
    subject: loanId ? `Crédito ${params.get('numero') ?? ''}` : '',
    body: '',
  });
  const [errors, setErrors] = useState({});
  const { run, busy } = useAppAction();

  const loadList = useCallback(() => appApi('/support/tickets').then((d) => { setList(d); setListError(null); }).catch(setListError), []);
  usePolling(loadList, POLL_MS, []);

  async function create() {
    const found = validate(form, {
      subject: [rules.required('Escribe un asunto'), rules.minLen(4)],
      body: [rules.required('Cuéntanos qué pasó o qué necesitas'), rules.minLen(10, 'Danos un poco más de detalle (mínimo 10 caracteres)')],
    });
    setErrors(found);
    if (Object.keys(found).length) { focusFirstError(); return; }
    const r = await run(() => appApi('/support/tickets', { method: 'POST', body: { ...form, ...(loanId && { relatedLoanId: loanId }) } }), 'Solicitud enviada. Te avisaremos cuando respondamos.');
    if (r.ok) {
      setCreating(false);
      setParams({});
      setTab('solicitudes');
      setOpen(r.result._id);
      loadList();
    }
  }

  const [tf, setTf] = useState({ q: '', status: '', type: '' });
  const allTickets = list?.tickets ?? [];
  const tickets = allTickets.filter((t) => (!tf.q || `${t.subject} ${t.number} ${t.lastMessagePreview ?? ''}`.toLowerCase().includes(tf.q.toLowerCase()))
    && (!tf.status || (tf.status === 'abiertas' ? !['resuelto', 'cerrado'].includes(t.status) : t.status === tf.status)) && (!tf.type || t.type === tf.type));
  const chatUnread = list?.chat?.unreadForUser ?? 0;
  const ticketUnread = tickets.reduce((a, t) => a + t.unreadForUser, 0);

  return (
    <>
      <PageHeader title="Soporte" subtitle="Escríbele al equipo de FinanPro o crea una solicitud para algo puntual."
        actions={<Button onClick={() => { setErrors({}); setCreating(true); }}>Nueva solicitud</Button>} />

      <div className="tabs tabs-page" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>Chat {chatUnread > 0 && <span className="count-badge">{chatUnread}</span>}</button>
        <button type="button" role="tab" aria-selected={tab === 'solicitudes'} className={tab === 'solicitudes' ? 'on' : ''} onClick={() => { setTab('solicitudes'); setOpen(null); }}>Solicitudes {ticketUnread > 0 && <span className="count-badge">{ticketUnread}</span>}</button>
      </div>

      {tab === 'chat' && <Thread path="/support/chat" sendPath={() => '/support/chat/messages'} onChanged={loadList} />}

      {tab === 'solicitudes' && (open ? (
        <Thread key={open} path={`/support/tickets/${open}`} sendPath={(t) => `/support/tickets/${t._id}/messages`} onBack={() => setOpen(null)} closable onChanged={loadList} />
      ) : (
        <Panel flush>
          {allTickets.length > 0 && (
            <div className="filters"><div className="filters-row">
              <SearchInput value={tf.q} onChange={(x) => setTf({ ...tf, q: x })} placeholder="Buscar por asunto o número" />
              <Select aria-label="Estado" value={tf.status} onChange={(e) => setTf({ ...tf, status: e.target.value })} options={{ abiertas: 'Abiertas', ...Object.fromEntries(Object.entries(TICKET_STATUS).map(([k, [x]]) => [k, x])) }} placeholder="Todas" />
              <Select aria-label="Tipo" value={tf.type} onChange={(e) => setTf({ ...tf, type: e.target.value })} options={TICKET_TYPES} placeholder="Todos los tipos" />
            </div></div>
          )}
          {listError ? <ErrorNote error={listError} onRetry={loadList} /> : !list ? <Loading /> : allTickets.length > 0 && tickets.length === 0 ? <Empty title="Ninguna solicitud con esos filtros" /> : tickets.length === 0 ? (
            <Empty title="No tienes solicitudes" action={<Button variant="secondary" onClick={() => setCreating(true)}>Crear una</Button>}>Úsalas para reportar fallas, pedir que eliminemos un crédito o corregir un pago.</Empty>
          ) : (
            <ul className="ticket-list">
              {tickets.map((t) => (
                <li key={t._id}>
                  <button type="button" onClick={() => setOpen(t._id)}>
                    <span className="ticket-main">
                      <strong>{t.subject}</strong>
                      <span className="muted small">#{t.number}, {TICKET_TYPES[t.type] ?? t.type}{t.relatedLoanId?.loanNumber ? `, ${t.relatedLoanId.loanNumber}` : ''}</span>
                      {t.lastMessagePreview && <span className="ticket-preview">{t.lastMessagePreview}</span>}
                    </span>
                    <span className="ticket-side">
                      <Badge tone={TICKET_STATUS[t.status][1]}>{TICKET_STATUS[t.status][0]}</Badge>
                      <span className="muted small">{dateTime(t.lastMessageAt)}</span>
                      {t.unreadForUser > 0 && <span className="count-badge">{t.unreadForUser}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ))}

      <Modal open={creating} title="Nueva solicitud" onClose={() => { setCreating(false); setParams({}); }} width={560}
        footer={<><Button variant="ghost" onClick={() => { setCreating(false); setParams({}); }}>Cancelar</Button><Button loading={busy} onClick={create}>Enviar solicitud</Button></>}>
        <FormErrors errors={errors} />
        {loanId && <p className="modal-lead">Sobre el crédito <strong>{params.get('numero')}</strong>.</p>}
        <Select label="¿Qué necesitas?" required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={TICKET_TYPES} />
        <Input label="Asunto" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} error={errors.subject} placeholder="Ej. No puedo registrar un pago" />
        <Textarea label="Detalle" required rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} error={errors.body}
          hint={form.type === 'eliminar_credito' ? 'Dinos por qué hay que eliminarlo. El crédito dejará de verse en tu cuenta, pero FinanPro conserva el historial.' : 'Qué hacías, qué esperabas que pasara y qué pasó.'} />
      </Modal>
    </>
  );
}
