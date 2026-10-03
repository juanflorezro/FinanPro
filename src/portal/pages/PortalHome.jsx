import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { usePortal } from '../PortalLayout.jsx';
import { Loading, ErrorNote, StatusBadge } from '../../components/ui.jsx';
import { money, date, relativeDays, daysFromNow } from '../../utils/format.js';
import { LOAN_STATUS, AMORTIZATION } from '../../utils/labels.js';

const OPEN = ['desembolsado', 'al_dia', 'en_mora', 'reestructurado'];
const owed = (l) => l.balancePrincipal + l.balanceInterest + l.balanceLateInterest + l.balanceFees;
export const paidPercent = (l) => (l.principal ? Math.min(100, Math.round(((l.principal - l.balancePrincipal) / l.principal) * 100)) : 0);

export function Progress({ value, label }) {
  return (
    <div className="p-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export default function PortalHome() {
  const { slug, token, call } = usePortal();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showPaid, setShowPaid] = useState(false);
  const load = useCallback(() => call('/me').then(setData).catch(setError), [call]);
  useEffect(() => { if (token) load(); }, [token, load]);

  if (!token) return <Navigate to={`/p/${slug}`} replace />;
  if (error) return <ErrorNote error={error} onRetry={load} />;
  if (!data) return <Loading />;

  const { borrower, loans } = data;
  const open = loans.filter((l) => OPEN.includes(l.status));
  const closed = loans.filter((l) => !OPEN.includes(l.status));
  const cur = loans[0]?.currency ?? 'COP';
  const totalOwed = open.reduce((a, l) => a + l.balancePrincipal, 0);
  const late = open.filter((l) => l.daysPastDue > 0);
  const next = open.filter((l) => l.nextDueDate).sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))[0];
  const nextDays = next ? daysFromNow(next.nextDueDate) : null;

  return (
    <div className="p-home">
      <h1 className="p-greeting">Hola, {borrower.firstName}</h1>

      {late.length > 0 && (
        <div className="p-alert" role="alert">
          <strong>Tienes {late.length === 1 ? 'un préstamo atrasado' : `${late.length} préstamos atrasados`}.</strong>
          <span> Ponerte al día evita que sigan sumando intereses de mora.</span>
        </div>
      )}

      <section className="p-summary">
        <div className="p-summary-main">
          <span>Saldo de capital</span>
          <strong>{money(totalOwed, cur)}</strong>
          <small>{open.length === 0 ? 'No tienes préstamos activos' : `${open.length} ${open.length === 1 ? 'préstamo activo' : 'préstamos activos'}`}</small>
        </div>
        {next && (
          <Link to={`/p/${slug}/prestamo/${next._id}`} className={`p-next ${nextDays < 0 ? 'late' : nextDays <= 3 ? 'soon' : ''}`}>
            <span>{nextDays < 0 ? 'Pago vencido' : 'Próximo pago'}</span>
            <strong>{money(next.nextDueAmount, cur)}</strong>
            <small>{date(next.nextDueDate)}, {relativeDays(next.nextDueDate)}</small>
          </Link>
        )}
      </section>

      <h2 className="p-section-title">Mis préstamos</h2>
      {open.length === 0 && <p className="muted">No tienes préstamos activos en este momento.</p>}
      <ul className="p-loans">
        {open.map((l) => (
          <li key={l._id}>
            <Link to={`/p/${slug}/prestamo/${l._id}`} className="p-loan">
              <div className="p-loan-top">
                <div><strong>Préstamo {l.loanNumber}</strong><small>{AMORTIZATION[l.amortization]?.[0]}, desde {date(l.disbursementDate)}</small></div>
                <StatusBadge map={LOAN_STATUS} value={l.status} />
              </div>
              <div className="p-loan-figures">
                <div><span>Saldo</span><strong>{money(owed(l), l.currency)}</strong></div>
                <div><span>Prestado</span><strong>{money(l.principal, l.currency)}</strong></div>
                <div><span>Próxima cuota</span><strong>{l.nextDueDate ? date(l.nextDueDate) : '—'}</strong></div>
              </div>
              <Progress value={paidPercent(l)} label="Capital pagado" />
              <small className="p-loan-foot">{paidPercent(l)}% del capital pagado{l.daysPastDue > 0 ? `, ${l.daysPastDue} días de atraso` : ''}</small>
            </Link>
          </li>
        ))}
      </ul>

      {closed.length > 0 && (
        <>
          <button type="button" className="p-toggle" onClick={() => setShowPaid((s) => !s)} aria-expanded={showPaid}>
            {showPaid ? 'Ocultar' : 'Ver'} préstamos terminados ({closed.length})
          </button>
          {showPaid && (
            <ul className="p-loans">
              {closed.map((l) => (
                <li key={l._id}>
                  <Link to={`/p/${slug}/prestamo/${l._id}`} className="p-loan p-loan-closed">
                    <div className="p-loan-top">
                      <div><strong>Préstamo {l.loanNumber}</strong><small>{money(l.principal, l.currency)}, terminado {date(l.closedAt)}</small></div>
                      <StatusBadge map={LOAN_STATUS} value={l.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
