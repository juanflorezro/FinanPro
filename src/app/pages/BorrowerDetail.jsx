import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { useToast } from '../../components/Toast.jsx';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, DefList, Modal, StatusBadge } from '../../components/ui.jsx';
import { money, date } from '../../utils/format.js';
import { LOAN_STATUS } from '../../utils/labels.js';
import { BorrowerForm, borrowerBody, borrowerToForm, BORROWER_STATUS, DOC_TYPES, BORROWER_RULES } from './Borrowers.jsx';
import { validate, serverFieldErrors, focusFirstError } from '../../utils/validation.js';
import { ExportButton } from '../../components/ExportButton.jsx';

export default function BorrowerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, org } = useAppAuth();
  const { data, error, loading, reload } = useAppApi(`/borrowers/${id}`);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const { run, busy } = useAppAction();
  const notify = useToast();
  const [access, setAccess] = useState(null);
  const [genBusy, setGenBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { borrower: b, loans } = data;
  const active = org.status === 'activa';
  const portalUrl = `${window.location.origin}/p/${org.slug}`;
  const portalMsg = access
    ? `Hola ${b.firstName}, consulta tus préstamos con ${org.name} aquí: ${portalUrl}\nToca "Ya tengo un código", escribe tu documento y este código: ${access.code} (vence en 1 hora).`
    : `Hola ${b.firstName}, consulta tus préstamos con ${org.name} aquí: ${portalUrl} (ingresa con tu documento).`;

  return (
    <>
      <PageHeader back={<Link to="/deudores" className="back">Deudores</Link>}
        title={`${b.firstName} ${b.lastName}`}
        subtitle={<><StatusBadge map={BORROWER_STATUS} value={b.status} /><span className="muted">{b.docType} {b.docNumber}, {b.code}</span></>}
        actions={<>
          <ExportButton path={`/exports/borrowers/${id}.xlsx`} label="Ficha en Excel" />
          {can('borrower.update') && active && <Button variant="secondary" onClick={() => { setForm(borrowerToForm(b)); setErrors({}); setEditing(true); }}>Editar</Button>}
          {can('loan.create') && active && b.status === 'activo' && <Button onClick={() => navigate(`/prestamos/nuevo?deudor=${b._id}`)}>Nuevo préstamo</Button>}
        </>} />

      <div className="grid-main">
        <Panel title="Préstamos" flush>
          {loans.length ? (
            <table className="table table-click">
              <thead><tr><th>Préstamo</th><th>Inicio</th><th className="num">Capital</th><th className="num">Saldo</th><th>Estado</th></tr></thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l._id} onClick={() => navigate(`/prestamos/${l._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/prestamos/${l._id}`)}>
                    <td><strong>{l.loanNumber}</strong><span className="cell-sub">{l.rate}% {l.rateBasis}</span></td>
                    <td className="nowrap">{date(l.disbursementDate ?? l.createdAt)}</td>
                    <td className="num">{money(l.principal, l.currency)}</td>
                    <td className="num">{money(l.balancePrincipal, l.currency)}</td>
                    <td><StatusBadge map={LOAN_STATUS} value={l.status} />{l.daysPastDue > 0 && <span className="cell-sub tone-bad">{l.daysPastDue} días de atraso</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty title="Sin préstamos todavía" />}
        </Panel>
        <div className="stack">
        <Panel title="Portal del cliente">
          <p className="panel-intro small">{b.email ? 'Puede entrar con su documento; el código le llega al correo.' : 'No tiene correo: genérale un código de acceso y compártelo por WhatsApp.'}</p>
          {access && (
            <div className="access-code">
              <span className="muted small">Código de acceso, vence a las {new Date(access.expiresAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
              <strong>{access.code}</strong>
            </div>
          )}
          <div className="row-actions wrap">
            <Button size="sm" loading={genBusy} onClick={async () => {
              setGenBusy(true);
              try { setAccess(await appApi(`/borrowers/${id}/portal-code`, { method: 'POST' })); } catch (e) { notify(e.message, 'bad'); } finally { setGenBusy(false); }
            }}>{access ? 'Generar otro código' : 'Generar código de acceso'}</Button>
            <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard?.writeText(portalMsg); notify('Mensaje copiado'); }}>Copiar mensaje</Button>
            {b.phone && <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${(b.phone.startsWith('57') ? '' : '57') + b.phone.replace(/\D/g, '')}?text=${encodeURIComponent(portalMsg)}`}>Enviar por WhatsApp</a>}
          </div>
        </Panel>
        <Panel title="Datos">
          <DefList items={[
            ['Documento', `${DOC_TYPES[b.docType]} ${b.docNumber}`],
            ['Celular', b.phone],
            b.phoneAlt && ['Otro teléfono', b.phoneAlt],
            ['Correo', b.email],
            ['Dirección', [b.address, b.neighborhood, b.city].filter(Boolean).join(', ')],
            ['Ocupación', b.occupation],
            ['Ingresos', b.monthlyIncome ? money(b.monthlyIncome, org.currency) : null],
            ['Calificación', b.riskRating],
            ['Registrado', date(b.createdAt)],
          ]} />
        </Panel>
        </div>
      </div>

      <Modal open={editing} title="Editar deudor" onClose={() => setEditing(false)} width={660}
        footer={<><Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          <Button loading={busy} onClick={async () => {
            const found = validate(form, BORROWER_RULES);
            setErrors(found);
            if (Object.keys(found).length) { focusFirstError(); return; }
            const r = await run(() => appApi(`/borrowers/${id}`, { method: 'PATCH', body: borrowerBody(form, true) }), 'Cambios guardados', { silentCodes: ['VALIDATION_ERROR'] });
            if (r.ok) { setEditing(false); reload(); } else setErrors(serverFieldErrors(r.error));
          }}>Guardar cambios</Button></>}>
        <BorrowerForm value={form} onChange={(v) => { setForm(v); if (Object.keys(errors).length) setErrors(validate(v, BORROWER_RULES)); }} editing errors={errors} />
      </Modal>
    </>
  );
}
