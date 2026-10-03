import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../api/useApi.js';
import { api } from '../../api/client.js';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { useAction } from '../../components/useAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, StatusBadge, Empty, DefList, Modal, Select, Textarea, Input, Badge, Pagination } from '../../components/ui.jsx';
import { money, date, dateTime, relativeDays, number, percent, toCents, fromCents, inputDate } from '../../utils/format.js';
import { EditDialog } from './EditDialog.jsx';
import { ORG_STATUS, SUB_STATUS, MEMBER_ROLES, LOAN_STATUS, INSTALLMENT_STATUS, MODALITIES, COUNTRIES } from '../../utils/labels.js';

/* ------------------------------------------------------------------ */
/* Acogida a la ley de tasa máxima                                     */
/* ------------------------------------------------------------------ */
function CompliancePanel({ org, onSaved }) {
  const { can } = useAdminAuth();
  const current = org.settings?.legalRateCompliance ?? { enabled: false, policy: 'bloquear', modality: 'consumo' };
  const [form, setForm] = useState({ enabled: current.enabled, policy: current.policy ?? 'bloquear', modality: current.modality ?? 'consumo', reason: '' });
  const caps = useApi('/admin/rate-caps', { country: org.country, modality: form.modality });
  const { run, busy } = useAction();
  const cap = (caps.data ?? []).find((c) => c.isCurrent);
  const dirty = form.enabled !== current.enabled || (form.enabled && (form.policy !== current.policy || form.modality !== current.modality));
  const editable = can('finanzas', 'soporte');

  async function save() {
    const ok = await run(() => api(`/admin/organizations/${org._id}/compliance`, { method: 'PATCH', body: form }), form.enabled ? 'La organización quedó acogida a la ley' : 'La organización quedó con tasa libre');
    if (ok) { setForm((f) => ({ ...f, reason: '' })); onSaved(); }
  }

  return (
    <Panel title="Tasa de interés" className="compliance">
      <div className="segmented" role="radiogroup" aria-label="Régimen de tasa">
        <button type="button" role="radio" aria-checked={!form.enabled} className={!form.enabled ? 'on' : ''} disabled={!editable} onClick={() => setForm({ ...form, enabled: false })}>
          <strong>Tasa libre</strong>
          <span>Cada préstamo usa la tasa que la empresa pacte, sin revisar el tope legal.</span>
        </button>
        <button type="button" role="radio" aria-checked={form.enabled} className={form.enabled ? 'on' : ''} disabled={!editable} onClick={() => setForm({ ...form, enabled: true })}>
          <strong>Acogida a la ley</strong>
          <span>Cada préstamo se compara con la tasa máxima legal vigente de {COUNTRIES[org.country] ?? org.country}.</span>
        </button>
      </div>

      {form.enabled && (
        <div className="compliance-rules">
          <Select label="Modalidad de crédito" value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })} options={MODALITIES} disabled={!editable} />
          <div className="cap-readout">
            <span className="muted small">Tope vigente para esta modalidad</span>
            {caps.loading ? <span className="muted">Consultando…</span> : cap ? (
              <>
                <span className="cap-figure">{percent(cap.maxAnnualEffectiveRate)} EA</span>
                <span className="muted small">{cap.sourceResolution ?? 'Sin resolución registrada'}, desde {date(cap.validFrom)}</span>
              </>
            ) : <span className="tone-warn">No hay tope cargado. <Link to="/admin/tasas">Regístralo</Link> o los préstamos {form.policy === 'bloquear' ? 'no se podrán crear' : 'se crearán sin revisión'}.</span>}
          </div>
          <fieldset className="choice span-2">
            <legend>Si un préstamo supera el tope</legend>
            <label><input type="radio" name="policy" checked={form.policy === 'bloquear'} disabled={!editable} onChange={() => setForm({ ...form, policy: 'bloquear' })} /> No permitir crearlo</label>
            <label><input type="radio" name="policy" checked={form.policy === 'advertir'} disabled={!editable} onChange={() => setForm({ ...form, policy: 'advertir' })} /> Permitirlo si quien lo crea confirma el aviso</label>
          </fieldset>
        </div>
      )}

      {editable && dirty && (
        <div className="compliance-save">
          <Input label="Motivo del cambio" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} hint="Queda en la bitácora junto con tu nombre." />
          <Button loading={busy} disabled={form.reason.trim().length < 5} onClick={save}>Guardar régimen de tasa</Button>
        </div>
      )}
      {current.changedAt && <p className="muted small compliance-meta">Último cambio el {dateTime(current.changedAt)}{current.reason ? `: ${current.reason}` : ''}</p>}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Soporte: acceso temporal y vista de préstamos                       */
/* ------------------------------------------------------------------ */
function LoanViewer({ orgId, loanId, grant, onClose, onChanged }) {
  const { data, loading, error, reload } = useApi(loanId ? `/admin/organizations/${orgId}/support/loans/${loanId}` : null);
  const tickets = useApi(loanId ? '/admin/support/tickets' : null, { orgId, status: 'abiertas', limit: 50 });
  const { run, busy } = useAction();
  const [mode, setMode] = useState(null); // 'delete' | 'restore'
  const [form, setForm] = useState({ reason: '', ticketId: '' });
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null); // 'datos' | 'condiciones' | { cuota }
  const canWrite = grant?.scope === 'escritura';
  const l = data?.loan;
  const sbase = `/admin/organizations/${orgId}/support`;
  const hasPayments = (data?.payments ?? []).some((p) => !p.isReversal && p.status === 'aplicado');
  const after = () => { reload(); onChanged(); };

  async function confirm() {
    const min = mode === 'delete' ? 10 : 5;
    if (form.reason.trim().length < min) { setErr(`Escribe el motivo (mínimo ${min} caracteres)`); return; }
    const ok = await run(() => api(`/admin/organizations/${orgId}/support/loans/${loanId}/${mode}`, {
      method: 'POST', body: { reason: form.reason.trim(), ...(mode === 'delete' && form.ticketId && { ticketId: form.ticketId }) },
    }), mode === 'delete' ? 'Crédito eliminado para el cliente. El historial queda aquí.' : 'Crédito restaurado');
    if (ok) { setMode(null); setForm({ reason: '', ticketId: '' }); reload(); onChanged(); }
  }

  return (
    <Modal open={Boolean(loanId)} title={l ? `Préstamo ${l.loanNumber}` : 'Préstamo'} onClose={() => { setMode(null); onClose(); }} width={880}>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : data && (
        <>
          {l.deletedAt && (
            <div className="notice notice-bad">
              <p><strong>Eliminado para el cliente</strong> el {dateTime(l.deletedAt)}{l.deletedByAdminId?.name ? ` por ${l.deletedByAdminId.name}` : ''}. Motivo: {l.deletedReason}</p>
            </div>
          )}
          <DefList items={[
            ['Deudor', `${l.borrowerId?.firstName} ${l.borrowerId?.lastName}, ${l.borrowerId?.docType} ${l.borrowerId?.docNumber}`],
            ['Capital', money(l.principal, l.currency)],
            ['Tasa', `${percent(l.rate)} ${l.rateBasis}, ${percent(l.rateAnnual)} EA`],
            ['Saldo de capital', money(l.balancePrincipal, l.currency)],
            ['Estado', <StatusBadge key="s" map={LOAN_STATUS} value={l.status} />],
            ['Días de mora', number(l.daysPastDue)],
            ['Creado', dateTime(l.createdAt)],
          ]} />
          <h3 className="subhead">Cuotas</h3>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>#</th><th>Vence</th><th className="num">Capital</th><th className="num">Interés</th><th className="num">Mora</th><th className="num">Condonado</th><th className="num">Pendiente</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {data.installments.map((i) => {
                  const pending = i.principalDue + i.interestDue + i.feesDue + i.lateInterestAccrued - i.principalPaid - i.interestPaid - i.feesPaid - i.lateInterestPaid - i.waived;
                  return (
                    <tr key={i._id}>
                      <td>{i.number}</td><td>{date(i.dueDate)}</td>
                      <td className="num">{money(i.principalDue)}</td><td className="num">{money(i.interestDue)}</td>
                      <td className="num">{money(i.lateInterestAccrued)}</td>
                      <td className="num">{i.waived ? money(i.waived) : '—'}</td>
                      <td className="num">{money(pending)}</td>
                      <td><StatusBadge map={INSTALLMENT_STATUS} value={i.status} /></td>
                      <td className="num">{canWrite && !l.deletedAt && i.status !== 'pagada' && <Button variant="ghost" size="sm" onClick={() => setEdit({ cuota: i, pending })}>Ajustar</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3 className="subhead">Pagos</h3>
          {data.payments.length ? (
            <div className="table-wrap">
              <table className="table compact">
                <thead><tr><th>Recibo</th><th>Fecha</th><th>Medio</th><th className="num">Valor</th><th>Estado</th></tr></thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p._id}><td>{p.receiptNumber}</td><td>{dateTime(p.paidAt)}</td><td>{p.method}</td><td className="num">{money(p.amount)}</td><td>{p.isReversal ? <Badge tone="warn">Reverso</Badge> : p.status === 'reversado' ? <Badge tone="neutral">Reversado</Badge> : <Badge tone="ok">Aplicado</Badge>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Sin pagos.</p>}

          <div className="danger-zone">
            {!canWrite ? (
              <p className="muted small">Para eliminar o restaurar este crédito abre el acceso de soporte con permiso "Ver y corregir".</p>
            ) : mode ? (
              <div className="form-grid">
                <p className="span-2">{mode === 'delete'
                  ? 'El crédito, sus cuotas y pagos dejarán de verse en la app del cliente, sus tableros y exportaciones. Aquí seguirás viendo todo el historial y lo puedes restaurar.'
                  : 'El crédito vuelve a aparecer en la app del cliente con sus cuotas y pagos.'}</p>
                <Textarea label="Motivo" required value={form.reason} onChange={(e) => { setForm({ ...form, reason: e.target.value }); setErr(''); }} error={err} className="span-2" />
                {mode === 'delete' && (
                  <Select label="Solicitud relacionada" value={form.ticketId} onChange={(e) => setForm({ ...form, ticketId: e.target.value })} placeholder="Ninguna"
                    options={Object.fromEntries((tickets.data?.items ?? []).filter((t) => t.type !== 'chat').map((t) => [t._id, `#${t.number} ${t.subject}`]))}
                    hint="Se le avisa al cliente en esa solicitud" className="span-2" />
                )}
                <div className="span-2 row-actions">
                  <Button variant="ghost" onClick={() => setMode(null)}>Cancelar</Button>
                  <Button variant={mode === 'delete' ? 'danger' : 'primary'} loading={busy} onClick={confirm}>{mode === 'delete' ? 'Eliminar para el cliente' : 'Restaurar crédito'}</Button>
                </div>
              </div>
            ) : l.deletedAt ? (
              <Button variant="secondary" onClick={() => setMode('restore')}>Restaurar crédito</Button>
            ) : (
              <div className="row-actions wrap">
                <Button variant="secondary" onClick={() => setEdit('datos')}>Editar datos</Button>
                <Button variant="secondary" onClick={() => setEdit('condiciones')} disabled={hasPayments} title={hasPayments ? 'Reversa primero los pagos' : undefined}>Corregir condiciones</Button>
                <Button variant="danger-ghost" onClick={() => setMode('delete')}>Eliminar para el cliente</Button>
              </div>
            )}
            {canWrite && !l.deletedAt && hasPayments && !mode && <p className="field-hint section-gap">Para corregir monto, tasa o cuotas, primero reversa los pagos aplicados desde la pestaña Pagos.</p>}
          </div>

          <EditDialog open={edit === 'datos'} title={`Editar datos de ${l.loanNumber}`} onClose={() => setEdit(null)}
            intro="Estos cambios no rehacen las cuotas. La mora nueva aplica desde hoy."
            initial={{ notes: l.notes ?? '', graceDays: String(l.graceDays ?? 0), lateRate: String(l.lateRate ?? '0'), lateRateBasis: l.lateRateBasis ?? 'mensual', lateInterestBase: l.lateInterestBase ?? 'capital', lendingRegime: l.lendingRegime ?? 'formal', status: '' }}
            fields={[
              { name: 'lendingRegime', label: 'Tipo', type: 'select', options: { formal: 'Formal', informal: 'Informal' } },
              { name: 'graceDays', label: 'Días de gracia', type: 'number' },
              { name: 'lateRate', label: 'Interés de mora (%)', type: 'decimal' },
              { name: 'lateRateBasis', label: 'La mora es', type: 'select', options: { mensual: 'mensual', anual: 'anual', diaria: 'diaria' } },
              { name: 'lateInterestBase', label: 'Mora sobre', type: 'select', options: { capital: 'Solo capital vencido', capital_e_interes: 'Capital e intereses' }, span: true },
              { name: 'status', label: 'Cambiar estado manualmente', type: 'select', placeholder: 'No cambiar', options: { castigado: 'Castigado (incobrable)', anulado: 'Anulado', ...(['solicitud', 'aprobado'].includes(l.status) && { solicitud: 'Solicitud', aprobado: 'Aprobado' }) }, span: true },
              { name: 'notes', label: 'Notas', type: 'textarea', span: true },
            ]}
            onSave={(v) => api(`${sbase}/loans/${loanId}`, { method: 'PATCH', body: {
              notes: v.notes, graceDays: Number(v.graceDays || 0), lateRate: String(v.lateRate || '0').replace(',', '.'), lateRateBasis: v.lateRateBasis,
              lateInterestBase: v.lateInterestBase, lendingRegime: v.lendingRegime, ...(v.status && { status: v.status }), reason: v.reason,
            } }).then(after)} />

          <EditDialog open={edit === 'condiciones'} title={`Corregir condiciones de ${l.loanNumber}`} onClose={() => setEdit(null)} danger confirmLabel="Rehacer el plan de cuotas"
            intro={['solicitud', 'aprobado'].includes(l.status) ? 'Aún no está desembolsado: solo se actualizan los datos.' : 'Se anulan las cuotas actuales y se genera un plan nuevo con estas condiciones. Solo es posible porque no tiene pagos aplicados.'}
            initial={{ principal: fromCents(l.principal), rate: String(l.rate), rateBasis: l.rateBasis, rateKind: l.rateKind ?? 'efectiva', interestBase: l.interestBase ?? 'saldo_capital', amortization: l.amortization, frequency: l.frequency, termCount: String(l.termCount ?? ''), disbursementDate: inputDate(l.disbursementDate), firstDueDate: inputDate(l.firstDueDate) }}
            fields={[
              { name: 'principal', label: 'Capital', type: 'money', required: true },
              { name: 'rate', label: 'Tasa (%)', type: 'decimal', required: true },
              { name: 'rateBasis', label: 'La tasa es', type: 'select', options: { mensual: 'mensual', anual: 'anual', quincenal: 'quincenal', semanal: 'semanal', diaria: 'diaria' } },
              { name: 'rateKind', label: 'Tipo', type: 'select', options: { efectiva: 'Efectiva', nominal: 'Nominal' } },
              { name: 'amortization', label: 'Forma de pago', type: 'select', options: { frances: 'Cuota fija', aleman: 'Capital fijo', interes_simple: 'Interés simple', solo_interes: 'Solo interés', abonos_libres: 'Abonos libres' } },
              { name: 'frequency', label: 'Frecuencia', type: 'select', options: { mensual: 'Mensual', quincenal: 'Quincenal', semanal: 'Semanal', diaria: 'Diaria' } },
              { name: 'termCount', label: 'Número de cuotas', type: 'number', hint: 'Vacío solo en abonos libres' },
              { name: 'interestBase', label: 'Interés sobre', type: 'select', options: { saldo_capital: 'Saldo', capital_inicial: 'Capital inicial' } },
              { name: 'disbursementDate', label: 'Fecha de desembolso', type: 'date' },
              { name: 'firstDueDate', label: 'Primera cuota', type: 'date' },
            ]}
            onSave={(v) => api(`${sbase}/loans/${loanId}/replan`, { method: 'POST', body: {
              principal: toCents(v.principal), rate: String(v.rate).replace(',', '.'), rateBasis: v.rateBasis, rateKind: v.rateKind, interestBase: v.interestBase,
              amortization: v.amortization, frequency: v.frequency, ...(v.amortization !== 'abonos_libres' && { termCount: Number(v.termCount) }),
              ...(v.disbursementDate && { disbursementDate: v.disbursementDate }), ...(v.firstDueDate && { firstDueDate: v.firstDueDate }), reason: v.reason,
            } }).then(after)} />

          <EditDialog open={Boolean(edit?.cuota)} title={`Ajustar cuota ${edit?.cuota?.number ?? ''}`} onClose={() => setEdit(null)}
            intro={edit?.cuota ? `Pendiente actual: ${money(edit.pending)}. Mora causada: ${money(edit.cuota.lateInterestAccrued - edit.cuota.lateInterestPaid)}.` : ''}
            initial={{ dueDate: inputDate(edit?.cuota?.dueDate), waive: '', resetLateInterest: 'no' }}
            fields={[
              { name: 'dueDate', label: 'Fecha de vencimiento', type: 'date' },
              { name: 'waive', label: 'Valor a condonar', type: 'money', hint: 'Opcional. Se descuenta de lo pendiente' },
              { name: 'resetLateInterest', label: 'Mora de esta cuota', type: 'select', options: { no: 'Dejarla como está', si: 'Condonar la mora causada' }, span: true },
            ]}
            onSave={(v) => api(`${sbase}/loans/${loanId}/installments/${edit.cuota._id}`, { method: 'PATCH', body: {
              ...(v.dueDate && v.dueDate !== inputDate(edit.cuota.dueDate) && { dueDate: v.dueDate }),
              ...(v.waive && { waive: toCents(v.waive) }), ...(v.resetLateInterest === 'si' && { resetLateInterest: true }), reason: v.reason,
            } }).then(after)} />
        </>
      )}
    </Modal>
  );
}

const SUPPORT_TABS = [['prestamos', 'Préstamos'], ['deudores', 'Deudores'], ['pagos', 'Pagos'], ['cajas', 'Cajas']];
const METHODS = { efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', pasarela: 'Pasarela', otro: 'Otro' };

function SupportPanel({ org, grant, onChange }) {
  const { can } = useAdminAuth();
  const { run, busy } = useAction();
  const [form, setForm] = useState({ reason: '', scope: 'lectura', minutes: '60', ticketRef: '' });
  const [tab, setTab] = useState('prestamos');
  const [status, setStatus] = useState('');
  const [deleted, setDeleted] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loanId, setLoanId] = useState(null);
  const base = `/admin/organizations/${org._id}/support`;
  const loans = useApi(grant && tab === 'prestamos' ? `${base}/loans` : null, { status, deleted, q, page, limit: 15 });
  const payments = useApi(grant && tab === 'pagos' ? `${base}/payments` : null, { page, limit: 20 });
  const cash = useApi(grant && (tab === 'cajas' || tab === 'pagos') ? `${base}/cash-accounts` : null);
  const [bq, setBq] = useState('');
  const borrowers = useApi(grant && tab === 'deudores' ? `${base}/borrowers` : null, { q: bq, page, limit: 15 });
  const [editing, setEditing] = useState(null); // { kind, item }
  const canWrite = grant?.scope === 'escritura';
  const cashOptions = Object.fromEntries((cash.data ?? []).map((c) => [c._id, c.name]));

  useEffect(() => { setPage(1); }, [status, deleted, q, tab, bq]);
  if (!can('soporte')) return null;

  if (!grant) {
    return (
      <Panel title="Acceso de soporte">
        <p className="muted panel-intro">Para ver toda la organización (préstamos, también los eliminados, pagos y cajas) abre un acceso temporal. Queda registrado con tu nombre y el motivo.</p>
        <div className="form-grid">
          <Textarea label="Motivo" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} hint="Ejemplo: solicitud #15, el cliente pide eliminar el crédito P000123." className="span-2" />
          <Select label="Permiso" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} options={{ lectura: 'Solo ver', escritura: 'Ver y corregir (recalcular, eliminar o restaurar créditos)' }} className="span-2" />
          <Select label="Duración" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} options={{ 30: '30 minutos', 60: '1 hora', 120: '2 horas', 240: '4 horas', 480: '8 horas' }} />
          <Input label="Ticket o caso" value={form.ticketRef} onChange={(e) => setForm({ ...form, ticketRef: e.target.value })} hint="Opcional" />
        </div>
        <div className="panel-foot">
          <Button loading={busy} disabled={form.reason.trim().length < 10} onClick={async () => {
            if (await run(() => api(`/admin/organizations/${org._id}/support-access`, { method: 'POST', body: { reason: form.reason, scope: form.scope, minutes: Number(form.minutes), ...(form.ticketRef && { ticketRef: form.ticketRef }) } }), 'Acceso de soporte abierto')) onChange();
          }}>Abrir acceso de soporte</Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Datos de la organización" flush actions={<Button variant="ghost" size="sm" loading={busy} onClick={async () => { if (await run(() => api(`/admin/organizations/${org._id}/support-access`, { method: 'DELETE' }), 'Acceso cerrado')) onChange(); }}>Cerrar acceso</Button>}>
      <div className="support-banner">
        <Badge tone="warn">{grant.scope === 'escritura' ? 'Ver y corregir' : 'Solo ver'}</Badge>
        <span>Abierto hasta las {new Date(grant.expiresAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}. Motivo: {grant.reason}</span>
      </div>
      <div className="toolbar">
        <div className="tabs">{SUPPORT_TABS.map(([k, t]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}</div>
      </div>

      {tab === 'prestamos' && (
        <>
          <div className="toolbar">
            <Input aria-label="Número de préstamo" placeholder="Buscar P000123" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select aria-label="Estado del préstamo" value={status} onChange={(e) => setStatus(e.target.value)} options={Object.fromEntries(Object.entries(LOAN_STATUS).map(([k, [t]]) => [k, t]))} placeholder="Todos los estados" />
            <Select aria-label="Eliminados" value={deleted} onChange={(e) => setDeleted(e.target.value)} options={{ incluir: 'Incluir eliminados', solo: 'Solo eliminados' }} placeholder="Sin eliminados" />
          </div>
          {loans.loading ? <Loading /> : loans.error ? <ErrorNote error={loans.error} onRetry={loans.reload} /> : !loans.data?.items?.length ? <Empty title="Sin préstamos" /> : (
            <>
              <table className="table table-click">
                <thead><tr><th>Préstamo</th><th>Deudor</th><th className="num">Capital</th><th className="num">Saldo</th><th>Mora</th><th>Estado</th></tr></thead>
                <tbody>
                  {loans.data.items.map((l) => (
                    <tr key={l._id} onClick={() => setLoanId(l._id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setLoanId(l._id)} className={l.deletedAt ? 'row-deleted' : ''}>
                      <td><strong>{l.loanNumber}</strong>{l.deletedAt && <> <Badge tone="bad">Eliminado</Badge></>}</td>
                      <td>{l.borrowerId?.firstName} {l.borrowerId?.lastName}<span className="cell-sub">{l.borrowerId?.docNumber}</span></td>
                      <td className="num">{money(l.principal, l.currency)}</td>
                      <td className="num">{money(l.balancePrincipal, l.currency)}</td>
                      <td>{l.daysPastDue ? `${l.daysPastDue} días` : '—'}</td>
                      <td><StatusBadge map={LOAN_STATUS} value={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} limit={15} total={loans.data.total} onPage={setPage} />
            </>
          )}
        </>
      )}

      {tab === 'deudores' && (
        <>
          <div className="toolbar"><Input aria-label="Buscar deudor" placeholder="Nombre o documento" value={bq} onChange={(e) => setBq(e.target.value)} /></div>
          {borrowers.loading ? <Loading /> : borrowers.error ? <ErrorNote error={borrowers.error} /> : !borrowers.data?.items?.length ? <Empty title="Sin deudores" /> : (
            <>
              <table className="table">
                <thead><tr><th>Deudor</th><th>Documento</th><th>Celular</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {borrowers.data.items.map((b) => (
                    <tr key={b._id}>
                      <td><strong>{b.firstName} {b.lastName}</strong><span className="cell-sub">{b.code}</span></td>
                      <td>{b.docType} {b.docNumber}</td><td>{b.phone}</td><td>{b.status}</td>
                      <td className="num">{canWrite && <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: 'borrower', item: b })}>Editar</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} limit={15} total={borrowers.data.total} onPage={setPage} />
            </>
          )}
        </>
      )}

      {tab === 'pagos' && (payments.loading ? <Loading /> : payments.error ? <ErrorNote error={payments.error} /> : !payments.data?.items?.length ? <Empty title="Sin pagos" /> : (
        <>
          <table className="table">
            <thead><tr><th>Recibo</th><th>Fecha</th><th>Préstamo</th><th>Deudor</th><th>Medio</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>
              {payments.data.items.map((p) => (
                <tr key={p._id}>
                  <td>{p.receiptNumber}{p.isReversal && <> <Badge tone="warn">Reverso</Badge></>}{p.status === 'reversado' && <> <Badge tone="neutral">Reversado</Badge></>}</td>
                  <td>{dateTime(p.paidAt)}</td><td>{p.loanId?.loanNumber}</td><td>{p.borrowerId?.firstName} {p.borrowerId?.lastName}</td>
                  <td>{METHODS[p.method] ?? p.method}</td>
                  <td className="num">{money(p.amount, p.currency)}</td>
                  <td className="num">{canWrite && !p.isReversal && (
                    <span className="row-actions end">
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: 'payment', item: p })}>Editar</Button>
                      {p.status === 'aplicado' && <Button variant="danger-ghost" size="sm" onClick={() => setEditing({ kind: 'reverse', item: p })}>Reversar</Button>}
                    </span>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} limit={20} total={payments.data.total} onPage={setPage} />
        </>
      ))}

      {tab === 'cajas' && (cash.loading ? <Loading /> : cash.error ? <ErrorNote error={cash.error} /> : !cash.data?.length ? <Empty title="Sin cajas" /> : (
        <table className="table">
          <thead><tr><th>Caja</th><th>Tipo</th><th>Estado</th><th /></tr></thead>
          <tbody>{cash.data.map((c) => <tr key={c._id}><td>{c.name}</td><td>{c.type}</td><td>{c.isActive ? 'Activa' : 'Inactiva'}</td><td className="num">{canWrite && <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: 'cash', item: c })}>Editar</Button>}</td></tr>)}</tbody>
        </table>
      ))}

      <LoanViewer orgId={org._id} loanId={loanId} grant={grant} onClose={() => setLoanId(null)} onChanged={loans.reload} />

      <EditDialog open={editing?.kind === 'borrower'} title="Editar deudor" onClose={() => setEditing(null)}
        initial={editing?.kind === 'borrower' ? Object.fromEntries(['docType', 'docNumber', 'firstName', 'lastName', 'phone', 'phoneAlt', 'email', 'address', 'neighborhood', 'city', 'riskRating', 'status'].map((k) => [k, editing.item[k] ?? ''])) : {}}
        fields={[
          { name: 'docType', label: 'Tipo de documento', type: 'select', options: { CC: 'CC', CE: 'CE', PPT: 'PPT', PAS: 'Pasaporte', NIT: 'NIT' } },
          { name: 'docNumber', label: 'Documento', required: true },
          { name: 'firstName', label: 'Nombres', required: true },
          { name: 'lastName', label: 'Apellidos', required: true },
          { name: 'phone', label: 'Celular', required: true },
          { name: 'phoneAlt', label: 'Otro teléfono' },
          { name: 'email', label: 'Correo', span: true },
          { name: 'address', label: 'Dirección', span: true },
          { name: 'neighborhood', label: 'Barrio' },
          { name: 'city', label: 'Ciudad' },
          { name: 'riskRating', label: 'Calificación', type: 'select', options: { A: 'A', B: 'B', C: 'C', D: 'D' } },
          { name: 'status', label: 'Estado', type: 'select', options: { activo: 'Activo', inactivo: 'Inactivo', bloqueado: 'Bloqueado' } },
        ]}
        onSave={(v) => api(`${base}/borrowers/${editing.item._id}`, { method: 'PATCH', body: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x]).filter(([k, x]) => x !== '' || ['email', 'phoneAlt'].includes(k))) }).then(borrowers.reload)} />

      <EditDialog open={editing?.kind === 'payment'} title={`Editar recibo ${editing?.item?.receiptNumber ?? ''}`} onClose={() => setEditing(null)}
        intro="Solo se corrigen datos que no cambian saldos. Para cambiar el valor, reversa el pago y que el cliente lo registre de nuevo."
        initial={editing?.kind === 'payment' ? { method: editing.item.method, externalReference: editing.item.externalReference ?? '', cashAccountId: editing.item.cashAccountId ?? '' } : {}}
        fields={[
          { name: 'method', label: 'Medio de pago', type: 'select', options: METHODS },
          { name: 'cashAccountId', label: 'Caja', type: 'select', options: cashOptions },
          { name: 'externalReference', label: 'Referencia', span: true },
        ]}
        onSave={(v) => api(`${base}/payments/${editing.item._id}`, { method: 'PATCH', body: { method: v.method, externalReference: v.externalReference, ...(v.cashAccountId && { cashAccountId: v.cashAccountId }), reason: v.reason } }).then(payments.reload)} />

      <EditDialog open={editing?.kind === 'reverse'} title={`Reversar recibo ${editing?.item?.receiptNumber ?? ''}`} onClose={() => setEditing(null)} danger confirmLabel="Reversar pago"
        intro={`Se crea un movimiento en negativo por ${money(editing?.item?.amount ?? 0)} y las cuotas vuelven a quedar como antes. El pago original no se borra.`}
        initial={{}} fields={[]}
        onSave={(v) => api(`${base}/payments/${editing.item._id}/reverse`, { method: 'POST', body: { reason: v.reason } }).then(payments.reload)} />

      <EditDialog open={editing?.kind === 'cash'} title="Editar caja" onClose={() => setEditing(null)}
        initial={editing?.kind === 'cash' ? { name: editing.item.name, isActive: editing.item.isActive ? 'si' : 'no' } : {}}
        fields={[
          { name: 'name', label: 'Nombre', required: true },
          { name: 'isActive', label: 'Estado', type: 'select', options: { si: 'Activa', no: 'Inactiva' } },
        ]}
        onSave={(v) => api(`${base}/cash-accounts/${editing.item._id}`, { method: 'PATCH', body: { name: v.name.trim(), isActive: v.isActive === 'si', reason: v.reason } }).then(cash.reload)} />
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
export default function OrganizationDetail() {
  const { id } = useParams();
  const { can } = useAdminAuth();
  const { data, error, loading, reload } = useApi(`/admin/organizations/${id}`);
  const { run, busy } = useAction();
  const [statusModal, setStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: 'activa', reason: '' });

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const { organization: org, subscription, members, stats, supportAccess } = data;
  const active = ['al_dia', 'en_mora', 'desembolsado'].reduce((a, k) => a + (stats.loansByStatus[k]?.count ?? 0), 0);
  const portfolio = ['al_dia', 'en_mora', 'desembolsado'].reduce((a, k) => a + (stats.loansByStatus[k]?.balancePrincipal ?? 0), 0);
  const overdue = stats.loansByStatus.en_mora?.count ?? 0;

  return (
    <>
      <PageHeader
        back={<Link to="/admin/organizaciones" className="back">Organizaciones</Link>}
        title={org.name}
        subtitle={<><StatusBadge map={ORG_STATUS} value={org.status} />{org.statusReason && <span className="muted"> {org.statusReason}</span>}</>}
        actions={can('soporte', 'finanzas') && <Button variant="secondary" onClick={() => { setStatusForm({ status: org.status, reason: '' }); setStatusModal(true); }}>Cambiar estado</Button>}
      />

      <section className="ledger ledger-compact" aria-label="Actividad de la organización">
        <dl className="ledger-cells">
          <div><dt>Deudores</dt><dd>{number(stats.borrowers)}</dd></div>
          <div><dt>Préstamos activos</dt><dd>{number(active)}</dd></div>
          <div><dt>En mora</dt><dd className={overdue ? 'tone-bad' : ''}>{number(overdue)}</dd></div>
          <div><dt>Cartera de capital</dt><dd className="dd-money">{money(portfolio, org.currency)}</dd></div>
          <div><dt>Cobrado en 30 días</dt><dd className="dd-money">{money(stats.payments30d.total, org.currency)}</dd></div>
          <div><dt>Último pago</dt><dd className="dd-small">{stats.lastPaymentAt ? dateTime(stats.lastPaymentAt) : 'Ninguno'}</dd></div>
        </dl>
      </section>

      <div className="grid-main">
        <div className="stack">
          <CompliancePanel org={org} onSaved={reload} />
          <SupportPanel org={org} grant={supportAccess} onChange={reload} />
        </div>
        <div className="stack">
          <Panel title="Suscripción">
            {subscription ? (
              <DefList items={[
                ['Plan', subscription.planId?.name],
                ['Estado', <StatusBadge key="s" map={SUB_STATUS} value={subscription.status} />],
                ['Pagado hasta', <>{date(subscription.currentPeriodEnd)} <span className="muted">({relativeDays(subscription.currentPeriodEnd)})</span></>],
                ['Cliente', <Link key="t" to={`/admin/clientes/${org.tenantAccountId}`}>Ver cliente</Link>],
              ]} />
            ) : <Empty title="Sin suscripción vinculada" />}
          </Panel>
          <Panel title="Datos">
            <DefList items={[
              ['Razón social', org.legalName],
              ['NIT', org.taxId],
              ['País y moneda', `${COUNTRIES[org.country] ?? org.country}, ${org.currency}`],
              ['Zona horaria', org.timezone],
              ['Creada', date(org.createdAt)],
            ]} />
          </Panel>
          <Panel title={`Equipo (${members.length})`} flush>
            <ul className="list">
              {members.map((m) => (
                <li key={m._id}>
                  <div>
                    <span>{m.userId?.name ?? m.userId?.email}</span>
                    <span className="cell-sub">{m.userId?.email}, {m.userId?.lastLoginAt ? `ingresó ${dateTime(m.userId.lastLoginAt)}` : 'sin ingresos'}</span>
                  </div>
                  <span className="list-meta">{MEMBER_ROLES[m.role]}{m.status === 'suspendida' && <Badge tone="bad">Suspendido</Badge>}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Modal open={statusModal} title="Cambiar estado de la organización" onClose={() => setStatusModal(false)}
        footer={<><Button variant="ghost" onClick={() => setStatusModal(false)}>Cancelar</Button>
          <Button loading={busy} disabled={statusForm.reason.trim().length < 5 || statusForm.status === org.status} onClick={async () => {
            if (await run(() => api(`/admin/organizations/${id}/status`, { method: 'PATCH', body: statusForm }), 'Estado actualizado')) { setStatusModal(false); reload(); }
          }}>Guardar estado</Button></>}>
        <Select label="Nuevo estado" value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })} options={Object.fromEntries(Object.entries(ORG_STATUS).map(([k, [t]]) => [k, t]))} />
        <ul className="hint-list">
          <li><strong>Activa:</strong> opera normal.</li>
          <li><strong>Solo lectura:</strong> pueden ver y exportar, no crear préstamos ni registrar pagos.</li>
          <li><strong>Suspendida:</strong> nadie del equipo puede entrar a operar.</li>
        </ul>
        <Textarea label="Motivo" value={statusForm.reason} onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })} />
      </Modal>
    </>
  );
}
