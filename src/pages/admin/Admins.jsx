import { useApi } from '../../api/useApi.js';
import { api } from '../../api/client.js';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { useAction } from '../../components/useAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Badge, Select } from '../../components/ui.jsx';
import { dateTime } from '../../utils/format.js';
import { ADMIN_ROLES } from '../../utils/labels.js';

export default function Admins() {
  const { admin: me } = useAdminAuth();
  const { data, error, loading, reload } = useApi('/admin/admins');
  const { run } = useAction();
  const update = async (id, body, msg) => { if (await run(() => api(`/admin/admins/${id}`, { method: 'PATCH', body }), msg)) reload(); };

  return (
    <>
      <PageHeader title="Administradores" subtitle="Tu equipo en la plataforma. Para agregar a alguien corre npm run create-admin en el servidor; así recibe su 2FA de forma segura." />
      <Panel flush>
        {loading ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Nombre</th><th>Rol</th><th>Último ingreso</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {data.map((a) => {
                const self = a.id === me.id;
                return (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong>{self && <> <Badge tone="info">Tú</Badge></>}<span className="cell-sub">{a.email}</span></td>
                    <td>{self ? ADMIN_ROLES[a.role] : (
                      <Select aria-label={`Rol de ${a.name}`} value={a.role} onChange={(e) => update(a.id, { role: e.target.value }, 'Rol actualizado')} options={ADMIN_ROLES} />
                    )}</td>
                    <td>{a.lastLoginAt ? dateTime(a.lastLoginAt) : 'Nunca'}</td>
                    <td>{a.status === 'activo' ? <Badge tone="ok">Activo</Badge> : <Badge tone="bad">Bloqueado</Badge>}</td>
                    <td className="num">{!self && (a.status === 'activo'
                      ? <Button variant="danger-ghost" size="sm" onClick={() => update(a.id, { status: 'bloqueado' }, 'Administrador bloqueado')}>Bloquear</Button>
                      : <Button variant="ghost" size="sm" onClick={() => update(a.id, { status: 'activo' }, 'Administrador desbloqueado')}>Desbloquear</Button>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
