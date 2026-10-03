import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../api/useApi.js';
import { api } from '../../api/client.js';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { useAction } from '../../components/useAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, StatusBadge, Empty, DefList, Modal, Select, Textarea, Input, Badge, Pagination } from '../../components/ui.jsx';
import { money, date, dateTime, relativeDays, number, percent } from '../../utils/format.js';
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
function LoanViewer({ orgId, loanId, onClose }) {
  const { data, loading, error } = useApi(loanId ? `/admin/organizations/${orgId}/support/loans/${loanId}` : null);
  return (
    <Modal open={Boolean(loanId)} title={data ? `Préstamo ${data.loan.loanNumber}` : 'Préstamo'} onClose={onClose} width={860}>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : data && (
        <>
          <DefList items={[
            ['Deudor', `${data.loan.borrowerId?.firstName} ${data.loan.borrowerId?.lastName}, ${data.loan.borrowerId?.docType} ${data.loan.borrowerId?.docNumber}`],
            ['Capital', money(data.loan.principal, data.loan.currency)],
            ['Tasa', `${percent(data.loan.rate)} ${data.loan.rateBasis}, ${percent(data.loan.rateAnnual)} EA`],
            ['Saldo de capital', money(data.loan.balancePrincipal, data.loan.currency)],
            ['Estado', <StatusBadge key="s" map={LOAN_STATUS} value={data.loan.status} />],
            ['Días de mora', number(data.loan.daysPastDue)],
          ]} />
          <h3 className="subhead">Cuotas</h3>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>#</th><th>Vence</th><th className="num">Capital</th><th className="num">Interés</th><th className="num">Mora</th><th className="num">Pendiente</th><th>Estado</th></tr></thead>
              <tbody>
                {data.installments.map((i) => (
                  <tr key={i._id}>
                    <td>{i.number}</td><td>{date(i.dueDate)}</td>
                    <td className="num">{money(i.principalDue)}</td><td className="num">{money(i.interestDue)}</td>
                    <td className="num">{money(i.lateInterestAccrued)}</td>
                    <td className="num">{money(i.principalDue + i.interestDue + i.feesDue + i.lateInterestAccrued - i.principalPaid - i.interestPaid - i.feesPaid - i.lateInterestPaid - i.waived)}</td>
                    <td><StatusBadge map={INSTALLMENT_STATUS} value={i.status} /></td>
                  </tr>
                ))}
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
        </>
      )}
    </Modal>
  );
}

function SupportPanel({ org, grant, onChange }) {
  const { can } = useAdminAuth();
  const { run, busy } = useAction();
  const [form, setForm] = useState({ reason: '', scope: 'lectura', minutes: '60', ticketRef: '' });
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loanId, setLoanId] = useState(null);
  const loans = useApi(grant ? `/admin/organizations/${org._id}/support/loans` : null, { status, page, limit: 15 });

  useEffect(() => { setPage(1); }, [status]);
  if (!can('soporte')) return null;

  if (!grant) {
    return (
      <Panel title="Acceso de soporte">
        <p className="muted panel-intro">Para ver deudores, préstamos y pagos de esta organización abre un acceso temporal. Queda registrado con tu nombre y el motivo.</p>
        <div className="form-grid">
          <Textarea label="Motivo" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} hint="Ejemplo: el cliente reporta que un pago no se aplicó al préstamo P000123." className="span-2" />
          <Select label="Permiso" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} options={{ lectura: 'Solo ver', escritura: 'Ver y recalcular préstamos' }} />
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
    <Panel title="Acceso de soporte" flush actions={<Button variant="ghost" size="sm" loading={busy} onClick={async () => { if (await run(() => api(`/admin/organizations/${org._id}/support-access`, { method: 'DELETE' }), 'Acceso cerrado')) onChange(); }}>Cerrar acceso</Button>}>
      <div className="support-banner">
        <Badge tone="warn">{grant.scope === 'escritura' ? 'Ver y recalcular' : 'Solo ver'}</Badge>
        <span>Abierto hasta las {new Date(grant.expiresAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}. Motivo: {grant.reason}</span>
      </div>
      <div className="toolbar">
        <Select aria-label="Estado del préstamo" value={status} onChange={(e) => setStatus(e.target.value)} options={Object.fromEntries(Object.entries(LOAN_STATUS).map(([k, [t]]) => [k, t]))} placeholder="Todos los préstamos" />
      </div>
      {loans.loading ? <Loading /> : loans.error ? <ErrorNote error={loans.error} onRetry={loans.reload} /> : loans.data.items.length === 0 ? <Empty title="Sin préstamos" /> : (
        <>
          <table className="table table-click">
            <thead><tr><th>Préstamo</th><th>Deudor</th><th className="num">Capital</th><th className="num">Saldo</th><th>Mora</th><th>Estado</th></tr></thead>
            <tbody>
              {loans.data.items.map((l) => (
                <tr key={l._id} onClick={() => setLoanId(l._id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setLoanId(l._id)}>
                  <td><strong>{l.loanNumber}</strong></td>
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
      <LoanViewer orgId={org._id} loanId={loanId} onClose={() => setLoanId(null)} />
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
