import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../api/useApi.js';
import { api } from '../../api/client.js';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { useAction } from '../../components/useAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, StatusBadge, Empty, DefList, Modal, Input, Select, Textarea } from '../../components/ui.jsx';
import { money, date, dateTime, relativeDays, toCents, fromCents, inputDate } from '../../utils/format.js';
import { TENANT_STATUS, SUB_STATUS, ORG_STATUS, CYCLES, PAY_METHODS, COUNTRIES } from '../../utils/labels.js';
import { TenantForm, cleanTenant } from './Tenants.jsx';

const limitText = (n, noun) => (n ? `${n} ${noun}` : `${noun} ilimitados`);

function PaymentFields({ value, onChange, plan }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const suggested = plan ? plan.price * Number(value.periods || 1) : null;
  return (
    <div className="form-grid">
      <Select label="Períodos pagados" value={value.periods} onChange={set('periods')}
        options={Object.fromEntries([1, 2, 3, 6, 12].map((n) => [n, `${n} × ${plan ? CYCLES[plan.billingCycle].toLowerCase() : 'período'}`]))} />
      <Input label="Valor recibido" inputMode="numeric" value={value.amount} onChange={set('amount')}
        placeholder={suggested != null ? fromCents(suggested) : ''}
        hint={suggested != null ? `Precio del plan: ${money(suggested, plan.currency)}. Déjalo vacío para usarlo.` : undefined} />
      <Select label="Medio de pago" value={value.method} onChange={set('method')} options={PAY_METHODS} />
      <Input label="Referencia" value={value.reference} onChange={set('reference')} hint="N° de transferencia o comprobante" />
      <Input label="Fecha del pago" type="date" value={value.paidAt} onChange={set('paidAt')} />
      <Input label="Nota" value={value.notes} onChange={set('notes')} />
    </div>
  );
}

const emptyPayment = () => ({ periods: '1', amount: '', method: 'transferencia', reference: '', paidAt: inputDate(new Date()), notes: '' });

function paymentBody(p) {
  return {
    periods: Number(p.periods),
    ...(p.amount !== '' && { amount: toCents(p.amount) }),
    method: p.method,
    ...(p.reference && { reference: p.reference }),
    ...(p.paidAt && { paidAt: p.paidAt }),
    ...(p.notes && { notes: p.notes }),
  };
}

export default function TenantDetail() {
  const { id } = useParams();
  const { can } = useAdminAuth();
  const { data, error, loading, reload } = useApi(`/admin/tenants/${id}`);
  const plans = useApi('/admin/plans');
  const { run, busy } = useAction();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const { account, subscription, payments, organizations, allowedEmails } = data;
  const activePlans = (plans.data ?? []).filter((p) => p.isActive);
  const planOptions = Object.fromEntries(activePlans.map((p) => [p._id, `${p.name}, ${money(p.price, p.currency)} ${CYCLES[p.billingCycle].toLowerCase()}`]));
  const selectedPlan = activePlans.find((p) => p._id === (form.planId ?? subscription?.planId?._id));
  const finance = can('finanzas');
  const suspended = account.status === 'suspendido';

  const open = (name, initial = {}) => { setForm(initial); setModal(name); };
  const close = () => setModal(null);
  const done = async (fn, msg) => { if (await run(fn, msg)) { close(); reload(); } };

  const actions = finance && (
    <>
      {!suspended && (!subscription || ['prospecto', 'pendiente_pago'].includes(account.status)) && (
        <Button onClick={() => open('enable', { planId: activePlans[0]?._id ?? '', mode: 'trial', trialDays: '15', ownerEmail: account.contactEmail, sendEmail: true, payment: emptyPayment() })}>Habilitar cliente</Button>
      )}
      {subscription && !suspended && <Button variant="secondary" onClick={() => open('payment', emptyPayment())}>Registrar pago</Button>}
      {suspended
        ? <Button variant="secondary" onClick={() => done(() => api(`/admin/tenants/${id}/reactivate`, { method: 'POST' }), 'Cliente reactivado')}>Reactivar</Button>
        : <Button variant="danger-ghost" onClick={() => open('suspend', { reason: '' })}>Suspender</Button>}
    </>
  );

  return (
    <>
      <PageHeader
        back={<Link to="/admin/clientes" className="back">Clientes</Link>}
        title={account.tradeName || account.legalName}
        subtitle={<><StatusBadge map={TENANT_STATUS} value={account.status} /> <span className="muted">{account.contactEmail}</span></>}
        actions={actions}
      />

      <div className="grid-main">
        <div className="stack">
          <Panel title="Suscripción" actions={finance && subscription && !suspended && <Button variant="ghost" size="sm" onClick={() => open('plan', { planId: subscription.planId?._id })}>Cambiar plan</Button>}>
            {subscription ? (
              <div className="sub-summary">
                <div className="sub-plan">
                  <span className="sub-plan-name">{subscription.planId?.name}</span>
                  <span className="muted">{money(subscription.planId?.price, subscription.planId?.currency)} {CYCLES[subscription.planId?.billingCycle]?.toLowerCase()}</span>
                </div>
                <DefList items={[
                  ['Estado', <StatusBadge key="s" map={SUB_STATUS} value={subscription.status} />],
                  ['Pagado hasta', <>{date(subscription.currentPeriodEnd)} <span className="muted">({relativeDays(subscription.currentPeriodEnd)})</span></>],
                  ['Gracia hasta', date(subscription.graceUntil)],
                  ['Límites', [limitText(subscription.limitsSnapshot?.maxUsers, 'usuarios'), limitText(subscription.limitsSnapshot?.maxBorrowers, 'deudores'), limitText(subscription.limitsSnapshot?.maxActiveLoans, 'préstamos activos')].join(', ')],
                ]} />
              </div>
            ) : <Empty title="Sin plan asignado">Habilita al cliente para asignarle un plan y enviarle el acceso.</Empty>}
          </Panel>

          <Panel title="Pagos a la plataforma" flush>
            {payments.length ? (
              <table className="table">
                <thead><tr><th>Fecha</th><th>Período cubierto</th><th>Medio</th><th>Registró</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>{date(p.paidAt)}{p.reference && <span className="cell-sub">Ref. {p.reference}</span>}</td>
                      <td>{date(p.periodFrom)} al {date(p.periodTo)}</td>
                      <td>{PAY_METHODS[p.method]}</td>
                      <td>{p.registeredBy?.name ?? '—'}</td>
                      <td className="num">{money(p.amount, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty title="Sin pagos registrados" />}
          </Panel>

          <Panel title="Organizaciones" flush>
            {organizations.length ? (
              <table className="table">
                <thead><tr><th>Organización</th><th>Dueño</th><th>Estado</th><th>Creada</th></tr></thead>
                <tbody>
                  {organizations.map((o) => (
                    <tr key={o._id}>
                      <td><Link to={`/admin/organizaciones/${o._id}`}>{o.name}</Link></td>
                      <td>{o.ownerUserId?.email}<span className="cell-sub">{o.ownerUserId?.lastLoginAt ? `Último ingreso ${dateTime(o.ownerUserId.lastLoginAt)}` : 'No ha ingresado'}</span></td>
                      <td><StatusBadge map={ORG_STATUS} value={o.status} /></td>
                      <td>{date(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty title="Aún no crea su organización">{account.status === 'habilitado' ? 'El correo ya está habilitado. Cuando el dueño entre, la organización aparecerá aquí.' : 'Primero habilita al cliente.'}</Empty>}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Datos del cliente" actions={finance && <Button variant="ghost" size="sm" onClick={() => open('edit', { ...account })}>Editar</Button>}>
            <DefList items={[
              ['Razón social', account.legalName],
              ['Documento', account.taxId ? `${account.taxIdType} ${account.taxId}` : null],
              ['Contacto', account.contactName],
              ['Teléfono', account.contactPhone],
              ['Ubicación', [account.city, COUNTRIES[account.country] ?? account.country].filter(Boolean).join(', ')],
              ['Habilitado', account.approvedAt ? date(account.approvedAt) : null],
              account.internalNotes && ['Notas', account.internalNotes],
            ]} />
          </Panel>

          <Panel title="Correos habilitados" flush>
            {allowedEmails.length ? (
              <ul className="list">
                {allowedEmails.map((e) => (
                  <li key={e._id}>
                    <div>
                      <span>{e.email}</span>
                      <span className="cell-sub">{e.orgId ? 'Invitación de la empresa' : 'Dueño'}, {e.status === 'habilitado' ? 'pendiente de ingresar' : e.status === 'usado' ? `usado el ${date(e.usedAt)}` : e.status}</span>
                    </div>
                    {e.status === 'habilitado' && (can('finanzas', 'soporte')) && (
                      <Button variant="ghost" size="sm" onClick={() => done(() => api(`/admin/tenants/${id}/allowed-emails/${e._id}`, { method: 'DELETE' }), 'Correo revocado')}>Revocar</Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : <Empty title="Ningún correo habilitado" />}
            {account.status === 'habilitado' && (
              <div className="panel-foot">
                <Button variant="ghost" size="sm" loading={busy} onClick={() => run(() => api(`/admin/tenants/${id}/resend-welcome`, { method: 'POST' }), 'Correo de bienvenida reenviado')}>Reenviar correo de bienvenida</Button>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ---------- Habilitar ---------- */}
      <Modal open={modal === 'enable'} title="Habilitar cliente" onClose={close} width={640}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button loading={busy} disabled={!form.planId || !form.ownerEmail} onClick={() => done(() => api(`/admin/tenants/${id}/enable`, {
            method: 'POST',
            body: {
              planId: form.planId,
              ownerEmail: form.ownerEmail,
              sendEmail: form.sendEmail,
              ...(form.mode === 'trial' ? { trialDays: Number(form.trialDays) } : { payment: paymentBody(form.payment) }),
            },
          }), 'Cliente habilitado')}>Habilitar y enviar acceso</Button></>}>
        <div className="form-grid">
          <Select label="Plan" value={form.planId ?? ''} onChange={(e) => setForm({ ...form, planId: e.target.value })} options={planOptions} placeholder={activePlans.length ? undefined : 'Primero crea un plan'} className="span-2" />
          <Input label="Correo del dueño" type="email" value={form.ownerEmail ?? ''} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} hint="Solo este correo podrá crear la organización." className="span-2" />
          <fieldset className="choice span-2">
            <legend>¿Cómo empieza?</legend>
            <label><input type="radio" name="mode" checked={form.mode === 'trial'} onChange={() => setForm({ ...form, mode: 'trial' })} /> Con días de prueba</label>
            <label><input type="radio" name="mode" checked={form.mode === 'paid'} onChange={() => setForm({ ...form, mode: 'paid' })} /> Ya pagó</label>
          </fieldset>
          {form.mode === 'trial'
            ? <Input label="Días de prueba" type="number" min="1" max="90" value={form.trialDays ?? ''} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
            : <div className="span-2"><PaymentFields value={form.payment ?? emptyPayment()} onChange={(payment) => setForm({ ...form, payment })} plan={selectedPlan} /></div>}
          <label className="check span-2"><input type="checkbox" checked={Boolean(form.sendEmail)} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} /> Enviar correo de bienvenida con el enlace de acceso</label>
        </div>
      </Modal>

      {/* ---------- Registrar pago ---------- */}
      <Modal open={modal === 'payment'} title="Registrar pago" onClose={close} width={600}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button loading={busy} onClick={() => done(() => api(`/admin/tenants/${id}/payments`, { method: 'POST', body: paymentBody(form) }), 'Pago registrado')}>Registrar pago</Button></>}>
        <p className="modal-lead">El período se suma desde {subscription && new Date(subscription.currentPeriodEnd) > new Date() ? `el ${date(subscription.currentPeriodEnd)}, cuando vence el actual` : 'hoy, porque el anterior ya venció'}. Si la organización estaba en solo lectura por falta de pago, se reactiva.</p>
        <PaymentFields value={form} onChange={setForm} plan={subscription?.planId} />
      </Modal>

      {/* ---------- Cambiar plan ---------- */}
      <Modal open={modal === 'plan'} title="Cambiar plan" onClose={close}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button loading={busy} onClick={() => done(() => api(`/admin/tenants/${id}/plan`, { method: 'POST', body: { planId: form.planId } }), 'Plan actualizado')}>Cambiar plan</Button></>}>
        <Select label="Nuevo plan" value={form.planId ?? ''} onChange={(e) => setForm({ planId: e.target.value })} options={planOptions} />
        <p className="field-hint">Los límites nuevos aplican de inmediato. La fecha de vencimiento no cambia.</p>
      </Modal>

      {/* ---------- Suspender ---------- */}
      <Modal open={modal === 'suspend'} title="Suspender cliente" onClose={close}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button variant="danger" loading={busy} disabled={(form.reason ?? '').length < 5} onClick={() => done(() => api(`/admin/tenants/${id}/suspend`, { method: 'POST', body: { reason: form.reason } }), 'Cliente suspendido')}>Suspender</Button></>}>
        <p className="modal-lead">Sus organizaciones quedan bloqueadas: nadie del equipo podrá operar hasta que lo reactives. Los datos no se borran.</p>
        <Textarea label="Motivo" value={form.reason ?? ''} onChange={(e) => setForm({ reason: e.target.value })} hint="Queda registrado en la bitácora." />
      </Modal>

      {/* ---------- Editar ---------- */}
      <Modal open={modal === 'edit'} title="Editar cliente" onClose={close} width={640}
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button loading={busy} onClick={() => {
            const { legalName, tradeName, taxIdType, taxId, country, contactName, contactEmail, contactPhone, city, address, internalNotes } = form;
            done(() => api(`/admin/tenants/${id}`, { method: 'PATCH', body: cleanTenant({ legalName, tradeName, taxIdType, taxId, country, contactName, contactEmail, contactPhone, city, address, internalNotes }) }), 'Cambios guardados');
          }}>Guardar cambios</Button></>}>
        <TenantForm value={{ tradeName: '', taxId: '', contactName: '', contactPhone: '', city: '', address: '', internalNotes: '', ...form }} onChange={setForm} />
      </Modal>

    </>
  );
}
