import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { appApi } from '../../api/appClient.js';
import { useAppApi } from '../../api/useAppApi.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { useDebounced } from '../../utils/useDebounced.js';
import { PageHeader, Panel, Button, Input, Select, Textarea, Badge, Loading } from '../../components/ui.jsx';
import { money, date, percent, toCents, inputDate } from '../../utils/format.js';
import { AMORTIZATION, RATE_BASIS, FREQUENCY } from '../../utils/labels.js';

function BorrowerPicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const search = useDebounced(q, 250);
  const { data } = useAppApi(search.length >= 2 && !value ? '/borrowers' : null, { q: search, limit: 8 });
  if (value) {
    return (
      <div className="picked">
        <div><strong>{value.firstName} {value.lastName}</strong><span className="cell-sub">{value.docType} {value.docNumber}, {value.phone}</span></div>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Cambiar</Button>
      </div>
    );
  }
  return (
    <div className="picker">
      <Input label="Deudor" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe nombre o documento" autoFocus />
      {data?.items?.length > 0 && (
        <ul className="picker-list" role="listbox">
          {data.items.map((b) => (
            <li key={b._id}><button type="button" onClick={() => onChange(b)}><strong>{b.firstName} {b.lastName}</strong><span className="cell-sub">{b.docType} {b.docNumber}</span></button></li>
          ))}
        </ul>
      )}
      {search.length >= 2 && data?.items?.length === 0 && <p className="field-hint">No hay deudores con ese dato. <Link to="/deudores">Regístralo primero</Link>.</p>}
    </div>
  );
}

const INITIAL = {
  lendingRegime: 'formal', principal: '', rate: '', rateBasis: 'mensual', rateKind: 'efectiva', interestBase: 'saldo_capital',
  amortization: 'frances', frequency: 'mensual', termCount: '12', lateRate: '', lateRateBasis: 'mensual', graceDays: '0',
  firstDueDate: '', notes: '', disburseNow: true,
};

export default function NewLoan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { org } = useAppAuth();
  const settings = useAppApi('/settings');
  const preset = useAppApi(params.get('deudor') ? `/borrowers/${params.get('deudor')}` : null);
  const [borrower, setBorrower] = useState(null);
  const [form, setForm] = useState(INITIAL);
  const [sim, setSim] = useState(null);
  const [simError, setSimError] = useState('');
  const [ack, setAck] = useState(false);
  const { run, busy } = useAppAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  useEffect(() => { if (preset.data?.borrower) setBorrower(preset.data.borrower); }, [preset.data]);
  const regimes = settings.data?.settings?.allowedRegimes ?? ['formal', 'informal'];
  useEffect(() => { if (!regimes.includes(form.lendingRegime)) setForm((f) => ({ ...f, lendingRegime: regimes[0] })); }, [regimes.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const free = form.amortization === 'abonos_libres';
  const simBody = {
    principal: toCents(form.principal), rate: String(form.rate).replace(',', '.'), rateBasis: form.rateBasis, rateKind: form.rateKind,
    interestBase: form.interestBase, amortization: form.amortization, frequency: form.frequency,
    ...(!free && { termCount: Number(form.termCount) }), ...(form.firstDueDate && { firstDueDate: form.firstDueDate }),
  };
  const simKey = useDebounced(JSON.stringify(simBody), 400);

  useEffect(() => {
    const body = JSON.parse(simKey);
    if (!body.principal || !body.rate || Number.isNaN(Number(body.rate)) || (!free && !(body.termCount > 0))) { setSim(null); setSimError(''); return; }
    let cancelled = false;
    appApi('/loans/simulate', { method: 'POST', body })
      .then((r) => { if (!cancelled) { setSim(r); setSimError(''); } })
      .catch((e) => { if (!cancelled) { setSim(null); setSimError(e.message); } });
    return () => { cancelled = true; };
  }, [simKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = sim && !sim.compliance.ok && sim.compliance.code !== 'RATE_CAP_ACK_REQUIRED';
  const needsAck = sim?.compliance.code === 'RATE_CAP_ACK_REQUIRED';

  async function create() {
    const body = {
      ...simBody, borrowerId: borrower._id, lendingRegime: form.lendingRegime, graceDays: Number(form.graceDays || 0),
      ...(form.lateRate && { lateRate: String(form.lateRate).replace(',', '.'), lateRateBasis: form.lateRateBasis }),
      ...(form.notes && { notes: form.notes }), ...(needsAck && ack && { acknowledgeRateCap: true }),
    };
    delete body.firstDueDate;
    const created = await run(() => appApi('/loans', { method: 'POST', body }), form.disburseNow ? null : 'Préstamo creado');
    if (!created.ok) return;
    if (form.disburseNow) {
      await run(() => appApi(`/loans/${created.result._id}/disburse`, { method: 'POST', body: form.firstDueDate ? { firstDueDate: form.firstDueDate } : {} }), 'Préstamo creado y desembolsado');
    }
    navigate(`/prestamos/${created.result._id}`);
  }

  if (org.status !== 'activa') return <PageHeader title="Nuevo préstamo" subtitle="Tu empresa está en solo lectura; no se pueden crear préstamos." />;
  if (settings.loading) return <Loading />;

  return (
    <>
      <PageHeader back={<Link to="/prestamos" className="back">Préstamos</Link>} title="Nuevo préstamo" subtitle="La tasa la defines tú en cada préstamo. A la derecha ves las cuotas antes de crearlo." />
      <div className="grid-main loan-builder">
        <div className="stack">
          <Panel title="Deudor"><BorrowerPicker value={borrower} onChange={setBorrower} /></Panel>

          <Panel title="Condiciones">
            <div className="form-grid">
              {regimes.length > 1 && (
                <fieldset className="choice span-2">
                  <legend>Tipo de préstamo</legend>
                  <label><input type="radio" checked={form.lendingRegime === 'formal'} onChange={() => setForm({ ...form, lendingRegime: 'formal' })} /> Formal</label>
                  <label><input type="radio" checked={form.lendingRegime === 'informal'} onChange={() => setForm({ ...form, lendingRegime: 'informal' })} /> Informal</label>
                </fieldset>
              )}
              <Input label="Monto a prestar" inputMode="numeric" value={form.principal} onChange={set('principal')} placeholder="1000000" hint={form.principal ? money(toCents(form.principal), org.currency) : 'Sin puntos ni comas'} className="span-2" />
              <Input label="Tasa de interés (%)" inputMode="decimal" value={form.rate} onChange={set('rate')} placeholder="2.5" />
              <Select label="La tasa es" value={form.rateBasis} onChange={set('rateBasis')} options={RATE_BASIS} />
              {form.rateBasis === 'anual' && (
                <Select label="Tipo de tasa anual" value={form.rateKind} onChange={set('rateKind')} options={{ efectiva: 'Efectiva anual (EA)', nominal: 'Nominal (se divide por período)' }} className="span-2" />
              )}
            </div>
          </Panel>

          <Panel title="Forma de pago">
            <div className="amort-options" role="radiogroup" aria-label="Forma de pago">
              {Object.entries(AMORTIZATION).map(([k, [title, text]]) => (
                <button key={k} type="button" role="radio" aria-checked={form.amortization === k} className={form.amortization === k ? 'on' : ''} onClick={() => setForm({ ...form, amortization: k })}>
                  <strong>{title}</strong><span>{text}</span>
                </button>
              ))}
            </div>
            <div className="form-grid section-gap">
              <Select label={free ? 'Cobro de interés' : 'Frecuencia de las cuotas'} value={form.frequency} onChange={set('frequency')} options={FREQUENCY} />
              {!free && <Input label="Número de cuotas" type="number" min="1" max="600" value={form.termCount} onChange={set('termCount')} />}
              <Input label="Primera cuota" type="date" value={form.firstDueDate} onChange={set('firstDueDate')} min={inputDate(new Date())} hint="Vacío: un período después del desembolso" />
              {['aleman', 'solo_interes', 'abonos_libres'].includes(form.amortization) && (
                <Select label="El interés se calcula sobre" value={form.interestBase} onChange={set('interestBase')} options={{ saldo_capital: 'El saldo que va quedando', capital_inicial: 'El capital inicial' }} />
              )}
            </div>
          </Panel>

          <Panel title="Mora y notas">
            <div className="form-grid">
              <Input label="Interés de mora (%)" inputMode="decimal" value={form.lateRate} onChange={set('lateRate')} placeholder="0" hint="Se cobra sobre lo vencido" />
              <Select label="La mora es" value={form.lateRateBasis} onChange={set('lateRateBasis')} options={RATE_BASIS} />
              <Input label="Días de gracia" type="number" min="0" max="90" value={form.graceDays} onChange={set('graceDays')} hint="Días después del vencimiento sin cobrar mora" />
              <Textarea label="Notas" value={form.notes} onChange={set('notes')} className="span-2" />
            </div>
          </Panel>
        </div>

        <aside className="stack loan-preview">
          <Panel title="Vista previa">
            {!sim ? <p className="muted">{simError || 'Escribe el monto, la tasa y las cuotas para ver el plan.'}</p> : (
              <>
                <div className="rate-strip">
                  <div><span className="muted small">Por cuota</span><strong>{percent(sim.rates.ratePerPeriod, 4)}</strong></div>
                  <div><span className="muted small">Mensual</span><strong>{percent(sim.rates.rateMonthly, 3)}</strong></div>
                  <div><span className="muted small">Efectiva anual</span><strong>{percent(sim.rates.rateAnnual)}</strong></div>
                </div>
                {sim.compliance.code === 'RATE_CAP_ACK_REQUIRED' && (
                  <div className="notice notice-warn">
                    <p>{sim.compliance.message}</p>
                    <label className="check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Entiendo y quiero crear el préstamo con esta tasa</label>
                  </div>
                )}
                {blocked && <div className="notice notice-bad"><p>{sim.compliance.message}</p></div>}
                {sim.compliance.rateCapCheck === 'dentro' && <p className="small"><Badge tone="ok">Dentro del tope legal</Badge></p>}
                <dl className="deflist">
                  <div><dt>{free ? 'Interés del primer período' : 'Primera cuota'}</dt><dd><strong>{money(sim.schedule[0].principalDue + sim.schedule[0].interestDue, org.currency)}</strong></dd></div>
                  {!free && <div><dt>Total intereses</dt><dd>{money(sim.totals.interest, org.currency)}</dd></div>}
                  {!free && <div><dt>Total a pagar</dt><dd>{money(sim.totals.total, org.currency)}</dd></div>}
                  {!free && <div><dt>Última cuota</dt><dd>{date(sim.schedule.at(-1).dueDate)}</dd></div>}
                </dl>
                {!free && (
                  <div className="table-wrap preview-table">
                    <table className="table compact">
                      <thead><tr><th>#</th><th>Fecha</th><th className="num">Cuota</th><th className="num">Saldo</th></tr></thead>
                      <tbody>
                        {sim.schedule.slice(0, 24).map((r) => (
                          <tr key={r.number}><td>{r.number}</td><td className="nowrap">{date(r.dueDate)}</td><td className="num">{money(r.principalDue + r.interestDue, org.currency)}</td><td className="num">{money(r.closingBalance, org.currency)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {sim.schedule.length > 24 && <p className="muted small table-more">Y {sim.schedule.length - 24} cuotas más.</p>}
                  </div>
                )}
              </>
            )}
          </Panel>
          <Panel>
            <label className="check"><input type="checkbox" checked={form.disburseNow} onChange={set('disburseNow')} /> Desembolsar ahora (genera las cuotas de inmediato)</label>
            <Button className="btn-block section-gap" loading={busy} disabled={!borrower || !sim || blocked || (needsAck && !ack)} onClick={create}>
              {form.disburseNow ? 'Crear y desembolsar' : 'Crear préstamo'}
            </Button>
            {!borrower && <p className="field-hint">Elige el deudor para continuar.</p>}
          </Panel>
        </aside>
      </div>
    </>
  );
}
