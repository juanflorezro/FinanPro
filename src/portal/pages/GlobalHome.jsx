import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { usePortal } from '../PortalLayout.jsx';
import { Loading, ErrorNote, StatusBadge } from '../../components/ui.jsx';
import { money, date, relativeDays, daysFromNow } from '../../utils/format.js';
import { LOAN_STATUS, AMORTIZATION } from '../../utils/labels.js';
import { Progress, paidPercent } from './PortalHome.jsx';

const OPEN = ['desembolsado', 'al_dia', 'en_mora', 'reestructurado'];
const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Inicio del portal global: cuánto debe en total y a quién, agrupado por empresa. */
export default function GlobalHome() {
  const { token, call } = usePortal();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showPaid, setShowPaid] = useState(false);
  const load = useCallback(() => call('/me').then(setData).catch(setError), [call]);
  useEffect(() => { if (token) load(); }, [token, load]);

  if (!token) return <Navigate to="/portal" replace />;
  if (error) return <ErrorNote error={error} onRetry={load} />;
  if (!data) return <Loading />;

  const companies = data.companies.map((c) => {
    const open = c.loans.filter((l) => OPEN.includes(l.status));
    return {
      ...c, open, closed: c.loans.filter((l) => !OPEN.includes(l.status)),
      balance: open.reduce((a, l) => a + l.balancePrincipal, 0),
      late: open.filter((l) => l.daysPastDue > 0),
    };
  });
  const allOpen = companies.flatMap((c) => c.open.map((l) => ({ ...l, org: c.org })));
  const totals = allOpen.reduce((acc, l) => ({ ...acc, [l.currency]: (acc[l.currency] ?? 0) + l.balancePrincipal }), {});
  const next = allOpen.filter((l) => l.nextDueDate).sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))[0];
  const nextDays = next ? daysFromNow(next.nextDueDate) : null;
  const lateCount = allOpen.filter((l) => l.daysPastDue > 0).length;
  const owing = companies.filter((c) => c.open.length);
  const done = companies.filter((c) => !c.open.length && c.closed.length);
  const totalEntries = Object.entries(totals);

  return (
    <div className="p-home">
      <h1 className="p-greeting">Hola, {data.person.firstName}</h1>

      {lateCount > 0 && (
        <div className="p-alert" role="alert">
          <strong>Tienes {lateCount === 1 ? 'un préstamo atrasado' : `${lateCount} préstamos atrasados`}.</strong>
          <span> Ponerte al día evita que sigan sumando intereses de mora.</span>
        </div>
      )}

      <section className="p-summary">
        <div className="p-summary-main">
          <span>Saldo total de capital</span>
          {totalEntries.length === 0 ? <strong>{money(0, 'COP')}</strong> : totalEntries.map(([cur, v]) => <strong key={cur}>{money(v, cur)}</strong>)}
          <small>{owing.length === 0 ? 'No le debes a ninguna empresa' : `Le debes a ${owing.length} ${owing.length === 1 ? 'empresa' : 'empresas'}, ${allOpen.length} ${allOpen.length === 1 ? 'préstamo' : 'préstamos'}`}</small>
        </div>
        {next && (
          <Link to={`/portal/prestamo/${next.org.id}/${next._id}`} className={`p-next ${nextDays < 0 ? 'late' : nextDays <= 3 ? 'soon' : ''}`}>
            <span>{nextDays < 0 ? 'Pago vencido' : 'Tu próximo pago'}</span>
            <strong>{money(next.nextDueAmount, next.currency)}</strong>
            <small>{next.org.name}, {date(next.nextDueDate)}, {relativeDays(next.nextDueDate)}</small>
          </Link>
        )}
      </section>

      <h2 className="p-section-title">A quién le debes</h2>
      {owing.length === 0 && <p className="muted">No tienes préstamos activos en este momento.</p>}
      <div className="g-companies">
        {owing.map((c) => (
          <section key={c.org.id} className="g-company">
            <header className="g-company-head">
              {c.org.logoUrl ? <img src={c.org.logoUrl} alt="" /> : <span className="portal-mark" aria-hidden="true">{initials(c.org.name)}</span>}
              <div>
                <strong>{c.org.name}</strong>
                <small>{c.open.length} {c.open.length === 1 ? 'préstamo activo' : 'préstamos activos'}{c.late.length ? `, ${c.late.length} atrasado${c.late.length > 1 ? 's' : ''}` : ''}</small>
              </div>
              <div className="g-company-total"><span>Saldo</span><strong>{money(c.balance, c.org.currency)}</strong></div>
            </header>
            <ul className="g-loans">
              {c.open.map((l) => (
                <li key={l._id}>
                  <Link to={`/portal/prestamo/${c.org.id}/${l._id}`} className="g-loan">
                    <div className="g-loan-main">
                      <strong>Préstamo {l.loanNumber}</strong>
                      <small>{AMORTIZATION[l.amortization]?.[0]}, {money(l.principal, l.currency)} desde {date(l.disbursementDate)}</small>
                      <Progress value={paidPercent(l)} label="Capital pagado" />
                    </div>
                    <div className="g-loan-side">
                      <StatusBadge map={LOAN_STATUS} value={l.status} />
                      <strong>{money(l.balancePrincipal, l.currency)}</strong>
                      <small>{l.nextDueDate ? `Próxima: ${date(l.nextDueDate)}` : '—'}</small>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {(done.length > 0 || companies.some((c) => c.open.length && c.closed.length)) && (
        <>
          <button type="button" className="p-toggle" onClick={() => setShowPaid((s) => !s)} aria-expanded={showPaid}>
            {showPaid ? 'Ocultar' : 'Ver'} préstamos terminados ({companies.reduce((a, c) => a + c.closed.length, 0)})
          </button>
          {showPaid && (
            <ul className="p-loans">
              {companies.flatMap((c) => c.closed.map((l) => (
                <li key={l._id}>
                  <Link to={`/portal/prestamo/${c.org.id}/${l._id}`} className="p-loan p-loan-closed">
                    <div className="p-loan-top">
                      <div><strong>{c.org.name}, préstamo {l.loanNumber}</strong><small>{money(l.principal, l.currency)}, terminado {date(l.closedAt)}</small></div>
                      <StatusBadge map={LOAN_STATUS} value={l.status} />
                    </div>
                  </Link>
                </li>
              )))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
