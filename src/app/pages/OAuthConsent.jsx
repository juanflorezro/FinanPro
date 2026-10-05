import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { Button, Loading, Select } from '../../components/ui.jsx';
import { MEMBER_ROLES } from '../../utils/labels.js';
import { AFTER_LOGIN_KEY } from './Login.jsx';

const FIELDS = ['client_id', 'redirect_uri', 'response_type', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'];

/**
 * Pantalla de autorización OAuth: ChatGPT (u otra app MCP) pide acceso a FinanPro.
 * El usuario elige la empresa y aprueba o rechaza; luego se vuelve a la app que pidió acceso.
 */
export default function OAuthConsent() {
  const { me, ready } = useAppAuth();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const request = useMemo(() => Object.fromEntries(FIELDS.map((k) => [k, params.get(k) ?? undefined]).filter(([, v]) => v !== undefined)), [params]);
  const [client, setClient] = useState(null);
  const [orgId, setOrgId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // Ya llegamos: se borra el "volver aquí después del login"
  useEffect(() => { if (me) { try { sessionStorage.removeItem(AFTER_LOGIN_KEY); } catch { /* nada */ } } }, [me]);

  useEffect(() => {
    if (!me || !request.client_id) return;
    appApi(`/oauth/client?client_id=${encodeURIComponent(request.client_id)}`).then(setClient).catch((e) => setError(e.message));
    if (me.organizations.length === 1) setOrgId(String(me.organizations[0].id));
  }, [me, request.client_id]);

  if (!ready) return <div className="boot"><Loading label="Cargando" /></div>;
  if (!me) {
    try { sessionStorage.setItem(AFTER_LOGIN_KEY, location.pathname + location.search); } catch { /* sin almacenamiento */ }
    return <Navigate to="/login" replace />;
  }

  const appName = client?.name ?? params.get('client_name') ?? 'Una aplicación';
  const org = me.organizations.find((o) => String(o.id) === orgId);

  async function decide(decision) {
    if (decision === 'allow' && !orgId) { setError('Elige la empresa a la que darás acceso.'); return; }
    setBusy(decision); setError('');
    try {
      const r = await appApi('/oauth/approve', { method: 'POST', body: { ...request, decision, ...(orgId && { orgId }) } });
      window.location.assign(r.redirect);
    } catch (e) { setError(e.message); setBusy(''); }
  }

  return (
    <div className="consent">
      <div className="consent-card">
        <div className="consent-logos" aria-hidden="true">
          <span className="consent-app">{appName.slice(0, 1).toUpperCase()}</span>
          <span className="consent-link" />
          <span className="logo-mark">F</span>
        </div>
        <h1><strong>{appName}</strong> quiere conectarse a tu cuenta de FinanPro</h1>
        {client?.host && <p className="muted small">Volverás a {client.host}</p>}

        <div className="consent-who">
          <span className="muted small">Conectando como</span>
          <strong>{me.user.name ?? me.user.email}</strong>
          <span className="muted small">{me.user.email}</span>
        </div>

        {me.organizations.length === 0 ? (
          <p className="notice notice-warn">No perteneces a ninguna empresa todavía.</p>
        ) : (
          <Select label="Empresa" required value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="Elige la empresa"
            options={Object.fromEntries(me.organizations.map((o) => [o.id, `${o.name} (${MEMBER_ROLES[o.role] ?? o.role})`]))} />
        )}

        <div className="consent-scopes">
          <p className="small"><strong>Podrá, con los permisos de tu rol{org ? ` (${MEMBER_ROLES[org.role] ?? org.role})` : ''}:</strong></p>
          <ul>
            <li>Consultar la cartera, deudores, préstamos y pagos.</li>
            <li>Registrar deudores, préstamos y pagos cuando se lo pidas.</li>
          </ul>
          <p className="muted small">Todo queda en la bitácora. Puedes desconectarla cuando quieras en Configuración.</p>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="consent-actions">
          <Button variant="ghost" loading={busy === 'deny'} disabled={Boolean(busy)} onClick={() => decide('deny')}>Cancelar</Button>
          <Button loading={busy === 'allow'} disabled={Boolean(busy) || !me.organizations.length} onClick={() => decide('allow')}>Permitir acceso</Button>
        </div>
      </div>
    </div>
  );
}
