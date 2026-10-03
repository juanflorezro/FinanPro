import { useState } from 'react';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, Modal, Input, Select, Badge } from '../../components/ui.jsx';
import { date, dateTime } from '../../utils/format.js';
import { MEMBER_ROLES } from '../../utils/labels.js';

const RANK = { owner: 3, admin: 2, analista: 1, cobrador: 1, auditor: 1 };
const ROLE_HELP = {
  admin: 'Todo menos cambiar al dueño',
  analista: 'Deudores, préstamos y pagos',
  cobrador: 'Ve préstamos y registra pagos',
  auditor: 'Solo consulta',
};

export default function Team() {
  const { can, org } = useAppAuth();
  const { data, error, loading, reload } = useAppApi('/members');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'cobrador' });
  const { run, busy } = useAppAction();
  const myRank = RANK[org.role] ?? 0;
  const assignable = Object.fromEntries(Object.entries(ROLE_HELP).filter(([r]) => RANK[r] < myRank).map(([r, h]) => [r, `${MEMBER_ROLES[r]}: ${h}`]));
  const editable = org.status === 'activa';
  const act = async (fn, msg) => { const r = await run(fn, msg); if (r.ok) reload(); };

  return (
    <>
      <PageHeader title="Equipo" subtitle="Quiénes trabajan contigo y qué puede hacer cada uno."
        actions={can('member.create') && editable && <Button onClick={() => { setForm({ email: '', role: Object.keys(assignable).at(-1) ?? 'cobrador' }); setOpen(true); }}>Invitar persona</Button>} />
      {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : (
        <>
          <Panel title="Miembros" flush>
            <table className="table">
              <thead><tr><th>Persona</th><th>Rol</th><th>Último ingreso</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {data.members.map((m) => {
                  const manageable = editable && !m.isYou && RANK[m.role] < myRank && can('member.update');
                  return (
                    <tr key={m.id}>
                      <td><strong>{m.user?.name ?? m.user?.email}</strong>{m.isYou && <> <Badge tone="info">Tú</Badge></>}<span className="cell-sub">{m.user?.email}</span></td>
                      <td>{manageable
                        ? <Select aria-label="Rol" value={m.role} onChange={(e) => act(() => appApi(`/members/${m.id}`, { method: 'PATCH', body: { role: e.target.value } }), 'Rol actualizado')} options={Object.fromEntries(Object.keys(assignable).map((r) => [r, MEMBER_ROLES[r]]))} />
                        : MEMBER_ROLES[m.role]}</td>
                      <td>{m.user?.lastLoginAt ? dateTime(m.user.lastLoginAt) : 'Nunca'}</td>
                      <td>{m.status === 'activa' ? <Badge tone="ok">Activo</Badge> : <Badge tone="bad">Suspendido</Badge>}</td>
                      <td className="num">{manageable && (m.status === 'activa'
                        ? <Button variant="danger-ghost" size="sm" onClick={() => act(() => appApi(`/members/${m.id}`, { method: 'PATCH', body: { status: 'suspendida' } }), 'Acceso suspendido')}>Suspender</Button>
                        : <Button variant="ghost" size="sm" onClick={() => act(() => appApi(`/members/${m.id}`, { method: 'PATCH', body: { status: 'activa' } }), 'Acceso reactivado')}>Reactivar</Button>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <Panel title="Invitaciones pendientes" flush>
            {data.invitations.length ? (
              <ul className="list">
                {data.invitations.map((i) => (
                  <li key={i.id}>
                    <div><span>{i.email}</span><span className="cell-sub">{MEMBER_ROLES[i.role]}, {i.expired ? 'vencida' : `vence el ${date(i.expiresAt)}`}</span></div>
                    {editable && can('member.create') && RANK[i.role] < myRank && (
                      <span className="list-meta">
                        <Button variant="ghost" size="sm" onClick={() => act(() => appApi(`/members/invitations/${i.id}/resend`, { method: 'POST' }), 'Invitación reenviada')}>Reenviar</Button>
                        <Button variant="danger-ghost" size="sm" onClick={() => act(() => appApi(`/members/invitations/${i.id}`, { method: 'DELETE' }), 'Invitación cancelada')}>Cancelar</Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : <Empty title="No hay invitaciones pendientes" />}
          </Panel>
        </>
      )}
      <Modal open={open} title="Invitar persona" onClose={() => setOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button loading={busy} disabled={!form.email.includes('@')} onClick={async () => {
            const r = await run(() => appApi('/members/invitations', { method: 'POST', body: { email: form.email.trim(), role: form.role } }), 'Invitación enviada');
            if (r.ok) { setOpen(false); reload(); }
          }}>Enviar invitación</Button></>}>
        <Input label="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} hint="Le llega un correo; entra con Google o creando su contraseña." />
        <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={assignable} />
      </Modal>
    </>
  );
}
