import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useAppApi } from '../../api/useAppApi.js';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { useAppAction } from '../useAppAction.js';
import { useToast } from '../../components/Toast.jsx';
import { PageHeader, Panel, Button, Loading, ErrorNote, Input, Select, DefList, Badge, StatusBadge } from '../../components/ui.jsx';
import { date, percent } from '../../utils/format.js';
import { MODALITIES, SUB_STATUS } from '../../utils/labels.js';

const WATERFALL_LABEL = { mora: 'Interés de mora', cargo: 'Cargos', interes: 'Interés', capital: 'Capital' };
const TABS = [['empresa', 'Empresa'], ['prestamos', 'Préstamos'], ['portal', 'Portal de clientes'], ['seguridad', 'Mi seguridad']];

function PortalSettings({ data, editable, save, busy }) {
  const notify = useToast();
  const url = `${window.location.origin}/p/${data.organization.slug}`;
  const s = data.settings;
  const [form, setForm] = useState({ portalEnabled: s.portalEnabled !== false, portalAccess: s.portalAccess ?? 'documento' });
  return (
    <div className="grid-main">
      <Panel title="Portal de tus clientes">
        <p className="panel-intro">Tus deudores consultan aquí sus préstamos, cuotas y pagos con su documento (y, si lo activas, un código que les llega al correo). Es solo de consulta: no pueden cambiar nada.</p>
        <div className="portal-link">
          <code>{url}</code>
          <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard?.writeText(url); notify('Enlace copiado'); }}>Copiar</Button>
          <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">Abrir</a>
        </div>
        <div className="form-grid section-gap">
          <label className="check span-2"><input type="checkbox" checked={form.portalEnabled} disabled={!editable} onChange={(e) => setForm({ ...form, portalEnabled: e.target.checked })} /> Portal activo</label>
          <Select label="Cómo entran tus clientes" value={form.portalAccess} disabled={!editable} onChange={(e) => setForm({ ...form, portalAccess: e.target.value })} className="span-2"
            options={{ documento: 'Solo con su documento (más simple)', codigo: 'Documento + código de verificación (más seguro)' }}
            hint={form.portalAccess === 'documento' ? 'Cualquiera que conozca el documento de un cliente podrá ver sus saldos. Cámbialo a código cuando tus clientes tengan correo registrado.' : 'El código llega al correo del cliente, o se lo generas desde su ficha.'} />
        </div>
        {editable && <div className="panel-foot"><Button loading={busy} onClick={() => save({ settings: form }, 'Portal actualizado')}>Guardar</Button></div>}
      </Panel>
      <Panel title="Para que tus clientes puedan entrar">
        <ul className="hint-list">
          <li>El deudor debe estar registrado con su documento correcto.</li>
          <li>Si usas código, debe tener <strong>correo</strong> en su ficha. Si no tiene, genérale un código desde su ficha y envíaselo por WhatsApp.</li>
          <li>Compárteles el enlace por WhatsApp o en el recibo.</li>
        </ul>
      </Panel>
    </div>
  );
}

function Security() {
  const { user, loadMe } = useAppAuth();
  const { run, busy } = useAppAction();
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(null);

  useEffect(() => { if (setup) QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200 }).then(setQr); }, [setup]);

  if (backup) {
    return (
      <Panel title="Guarda tus códigos de respaldo">
        <p className="panel-intro">Cada uno sirve una sola vez si pierdes el celular. No los volveremos a mostrar.</p>
        <ul className="backup-codes">{backup.map((c) => <li key={c}>{c}</li>)}</ul>
        <div className="row-actions">
          <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(backup.join('\n'))}>Copiar</Button>
          <Button onClick={() => { setBackup(null); loadMe(); }}>Ya los guardé</Button>
        </div>
      </Panel>
    );
  }

  if (user.mfaEnabled) {
    return (
      <Panel title="App de autenticación">
        <p className="panel-intro"><Badge tone="ok">Activa</Badge> Al entrar con contraseña o con Google te pedimos el código de tu app.</p>
        <div className="inline-form">
          <Input label="Código actual para desactivarla" value={code} onChange={(e) => setCode(e.target.value.trim())} />
          <Button variant="danger-ghost" loading={busy} disabled={code.length < 6} onClick={async () => {
            const r = await run(() => appApi('/auth/mfa/totp/disable', { method: 'POST', body: { code } }), 'App de autenticación desactivada');
            if (r.ok) { setCode(''); loadMe(); }
          }}>Desactivar</Button>
          <Button variant="ghost" loading={busy} disabled={code.length < 6} onClick={async () => {
            const r = await run(() => appApi('/auth/mfa/backup-codes', { method: 'POST', body: { code } }));
            if (r.ok) { setCode(''); setBackup(r.result.backupCodes); }
          }}>Generar códigos de respaldo nuevos</Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="App de autenticación">
      {!setup ? (
        <>
          <p className="panel-intro">Hoy te enviamos un código al correo cada vez que entras con contraseña. Con una app como Google Authenticator el código está siempre en tu celular, sin esperar correos.</p>
          <Button loading={busy} onClick={async () => { const r = await run(() => appApi('/auth/mfa/totp/setup', { method: 'POST' })); if (r.ok) setSetup(r.result); }}>Configurar app de autenticación</Button>
        </>
      ) : (
        <div className="totp-setup">
          {qr && <img src={qr} alt="Código QR para la app de autenticación" width="200" height="200" />}
          <div className="stack">
            <p>1. Escanea el código con tu app, o escribe esta clave: <code className="secret">{setup.secret}</code></p>
            <p>2. Escribe el código de 6 dígitos que aparece.</p>
            <div className="inline-form">
              <Input label="Código" value={code} onChange={(e) => setCode(e.target.value.trim())} inputMode="numeric" maxLength={6} />
              <Button loading={busy} disabled={code.length !== 6} onClick={async () => {
                const r = await run(() => appApi('/auth/mfa/totp/enable', { method: 'POST', body: { code } }), 'App de autenticación activada');
                if (r.ok) { setCode(''); setSetup(null); setBackup(r.result.backupCodes); }
              }}>Activar</Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function Settings() {
  const { can, loadMe } = useAppAuth();
  const { data, error, loading, reload } = useAppApi('/settings');
  const { run, busy } = useAppAction();
  const [tab, setTab] = useState('empresa');
  const [orgForm, setOrgForm] = useState(null);
  const [loanForm, setLoanForm] = useState(null);

  useEffect(() => {
    if (!data) return;
    const o = data.organization;
    setOrgForm({ name: o.name ?? '', legalName: o.legalName ?? '', taxId: o.taxId ?? '', timezone: o.timezone ?? 'America/Bogota', logoUrl: o.logoUrl ?? '' });
    const s = data.settings;
    setLoanForm({ loanPrefix: s.loanPrefix ?? 'P', receiptPrefix: s.receiptPrefix ?? '', graceDays: String(s.graceDays ?? 0), allowedRegimes: s.allowedRegimes ?? ['formal', 'informal'], paymentWaterfall: s.paymentWaterfall ?? ['mora', 'cargo', 'interes', 'capital'] });
  }, [data]);

  if (loading || !orgForm) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const editable = can('org.update') && data.organization.status === 'activa';
  const save = async (body, msg) => { const r = await run(() => appApi('/settings', { method: 'PATCH', body }), msg); if (r.ok) { reload(); loadMe(); } };
  const move = (i, d) => { const w = [...loanForm.paymentWaterfall]; [w[i], w[i + d]] = [w[i + d], w[i]]; setLoanForm({ ...loanForm, paymentWaterfall: w }); };
  const toggleRegime = (r) => {
    const has = loanForm.allowedRegimes.includes(r);
    const next = has ? loanForm.allowedRegimes.filter((x) => x !== r) : [...loanForm.allowedRegimes, r];
    if (next.length) setLoanForm({ ...loanForm, allowedRegimes: next });
  };
  const rc = data.rateCompliance;

  return (
    <>
      <PageHeader title="Configuración" />
      <div className="tabs tabs-page" role="tablist">
        {TABS.map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}
      </div>

      {tab === 'empresa' && (
        <div className="grid-main">
          <Panel title="Datos de la empresa">
            <div className="form-grid">
              <Input label="Nombre comercial" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} disabled={!editable} className="span-2" />
              <Input label="Razón social" value={orgForm.legalName} onChange={(e) => setOrgForm({ ...orgForm, legalName: e.target.value })} disabled={!editable} />
              <Input label="NIT" value={orgForm.taxId} onChange={(e) => setOrgForm({ ...orgForm, taxId: e.target.value })} disabled={!editable} />
              <Input label="Logo (URL)" value={orgForm.logoUrl} onChange={(e) => setOrgForm({ ...orgForm, logoUrl: e.target.value })} disabled={!editable} hint="Opcional" className="span-2" />
            </div>
            {editable && <div className="panel-foot"><Button loading={busy} onClick={() => save(orgForm, 'Datos guardados')}>Guardar datos</Button></div>}
          </Panel>
          <div className="stack">
            <Panel title="Tu plan">
              {data.subscription ? (
                <DefList items={[
                  ['Plan', data.subscription.plan],
                  ['Estado', <StatusBadge key="s" map={SUB_STATUS} value={data.subscription.status} />],
                  ['Pagado hasta', date(data.subscription.currentPeriodEnd)],
                  ['Usuarios', data.subscription.limits?.maxUsers || 'Sin límite'],
                  ['Deudores', data.subscription.limits?.maxBorrowers || 'Sin límite'],
                  ['Préstamos activos', data.subscription.limits?.maxActiveLoans || 'Sin límite'],
                ]} />
              ) : <p className="muted">Sin plan asignado.</p>}
            </Panel>
            <Panel title="Tasa de interés legal">
              {rc.enabled ? (
                <>
                  <p className="panel-intro">Tu empresa está <strong>acogida a la ley de tasa máxima</strong> para {MODALITIES[rc.modality]?.toLowerCase()}. {rc.policy === 'bloquear' ? 'No se pueden crear préstamos por encima del tope.' : 'Si un préstamo supera el tope, se pide confirmación.'}</p>
                  {rc.currentCap ? <p className="cap-figure">{percent(rc.currentCap.maxAnnualEffectiveRate)} EA</p> : <p className="tone-warn">Todavía no hay tope vigente cargado.</p>}
                </>
              ) : <p className="muted">Tasa libre: cada préstamo usa la tasa que pactes.</p>}
              <p className="field-hint">Este régimen lo define FinanPro. Para cambiarlo, escríbenos.</p>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'prestamos' && (
        <Panel title="Reglas para préstamos y pagos">
          <div className="form-grid">
            <Input label="Prefijo de préstamos" value={loanForm.loanPrefix} onChange={(e) => setLoanForm({ ...loanForm, loanPrefix: e.target.value })} disabled={!editable} hint={`Ejemplo: ${loanForm.loanPrefix}000001`} />
            <Input label="Prefijo de recibos" value={loanForm.receiptPrefix} onChange={(e) => setLoanForm({ ...loanForm, receiptPrefix: e.target.value })} disabled={!editable} hint="Opcional" />
            <Input label="Días de gracia por defecto" type="number" min="0" max="60" value={loanForm.graceDays} onChange={(e) => setLoanForm({ ...loanForm, graceDays: e.target.value })} disabled={!editable} />
            <fieldset className="choice">
              <legend>Tipos de préstamo permitidos</legend>
              {['formal', 'informal'].map((r) => <label key={r}><input type="checkbox" checked={loanForm.allowedRegimes.includes(r)} onChange={() => toggleRegime(r)} disabled={!editable} /> {r === 'formal' ? 'Formal' : 'Informal'}</label>)}
            </fieldset>
            <div className="span-2">
              <p className="field-label">Orden en que se aplica cada pago</p>
              <ol className="waterfall">
                {loanForm.paymentWaterfall.map((k, i) => (
                  <li key={k}>
                    <span>{WATERFALL_LABEL[k]}</span>
                    {editable && <span className="list-meta">
                      <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${WATERFALL_LABEL[k]}`}>↑</button>
                      <button type="button" className="icon-btn" disabled={i === loanForm.paymentWaterfall.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar ${WATERFALL_LABEL[k]}`}>↓</button>
                    </span>}
                  </li>
                ))}
              </ol>
              <p className="field-hint">Lo normal es primero la mora, luego intereses y al final capital.</p>
            </div>
          </div>
          {editable && <div className="panel-foot"><Button loading={busy} onClick={() => save({ settings: { ...loanForm, graceDays: Number(loanForm.graceDays || 0) } }, 'Reglas guardadas')}>Guardar reglas</Button></div>}
        </Panel>
      )}

      {tab === 'portal' && <PortalSettings data={data} editable={editable} save={save} busy={busy} />}
      {tab === 'seguridad' && <Security />}
    </>
  );
}
