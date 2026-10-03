import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { PageHeader, Panel, Button, Loading, ErrorNote, Empty, DefList, Modal, StatusBadge } from '../../components/ui.jsx';
import { money, date } from '../../utils/format.js';
import { LOAN_STATUS } from '../../utils/labels.js';
import { BorrowerForm, borrowerBody, borrowerToForm, BORROWER_STATUS, DOC_TYPES } from './Borrowers.jsx';

export default function BorrowerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, org } = useAppAuth();
  const { data, error, loading, reload } = useAppApi(`/borrowers/${id}`);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const { run, busy } = useAppAction();

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { borrower: b, loans } = data;
  const active = org.status === 'activa';

  return (
    <>
      <PageHeader back={<Link to="/deudores" className="back">Deudores</Link>}
        title={`${b.firstName} ${b.lastName}`}
        subtitle={<><StatusBadge map={BORROWER_STATUS} value={b.status} /><span className="muted">{b.docType} {b.docNumber}, {b.code}</span></>}
        actions={<>
          {can('borrower.update') && active && <Button variant="secondary" onClick={() => { setForm(borrowerToForm(b)); setEditing(true); }}>Editar</Button>}
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

      <Modal open={editing} title="Editar deudor" onClose={() => setEditing(false)} width={660}
        footer={<><Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          <Button loading={busy} onClick={async () => {
            const r = await run(() => appApi(`/borrowers/${id}`, { method: 'PATCH', body: borrowerBody(form, true) }), 'Cambios guardados');
            if (r.ok) { setEditing(false); reload(); }
          }}>Guardar cambios</Button></>}>
        <BorrowerForm value={form} onChange={setForm} editing />
      </Modal>
    </>
  );
}
