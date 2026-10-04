import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { portalApi } from '../../api/portalClient.js';
import { usePortal } from '../PortalLayout.jsx';
import { Button, Input, Select } from '../../components/ui.jsx';
import { CodeInput } from '../../components/CodeInput.jsx';
import { GoogleButton } from '../../components/GoogleButton.jsx';

const DOCS = { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', PPT: 'Permiso por protección temporal', PAS: 'Pasaporte', NIT: 'NIT' };

/**
 * Entrada al portal del deudor. Siempre con el correo registrado en su ficha:
 *  1) Continuar con Google (el correo de Google debe ser el registrado), o
 *  2) Documento → código de 6 dígitos a ese correo.
 * Si no tiene correo registrado, se le pide que la empresa lo registre.
 */
export default function PortalLogin() {
  const { slug, company, token, signIn } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('start');
  const [doc, setDoc] = useState({ docType: 'CC', docNumber: '' });
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(location.state?.reason ?? '');
  const [noEmail, setNoEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const enter = useCallback((t) => {
    signIn(t);
    navigate(`/p/${slug}/inicio`, { replace: true });
  }, [signIn, navigate, slug]);

  const onGoogle = useCallback(async (idToken) => {
    setBusy(true); setError(''); setNoEmail(false);
    try {
      const r = await portalApi(slug, '/google', { method: 'POST', body: { idToken } });
      enter(r.token);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }, [slug, enter]);

  if (token) return <Navigate to={`/p/${slug}/inicio`} replace />;

  async function requestCode(e) {
    e?.preventDefault();
    const number = doc.docNumber.replace(/[.\s]/g, '');
    if (!/^[0-9A-Za-z-]{4,20}$/.test(number)) { setError('Escribe tu número de documento sin puntos ni espacios.'); return; }
    setBusy(true); setError(''); setNoEmail(false);
    try {
      const r = await portalApi(slug, '/request-code', { method: 'POST', body: { docType: doc.docType, docNumber: number } });
      setChallenge(r); setCode(''); setStep('code'); setWait(60);
    } catch (err) {
      if (err.code === 'NO_EMAIL') setNoEmail(true);
      setError(err.message);
    } finally { setBusy(false); }
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setError('');
    try {
      const r = await portalApi(slug, '/verify', { method: 'POST', body: { challengeId: challenge.challengeId, code: value } });
      enter(r.token);
    } catch (err) { setError(err.message); setCode(''); } finally { setBusy(false); }
  }

  return (
    <div className="portal-login">
      <section className="portal-hero">
        <p className="portal-eyebrow">{company.name}</p>
        <h1>Consulta tus préstamos</h1>
        <p>Mira cuánto debes, cuándo es tu próximo pago y todo lo que has pagado. Sin filas y sin llamar.</p>
        <ul className="portal-points">
          <li>Saldo y próxima cuota al día</li>
          <li>Historial de pagos con número de recibo</li>
          <li>Estado de cuenta para imprimir</li>
        </ul>
      </section>

      <div className="portal-card">
        {step === 'start' ? (
          <div className="portal-form">
            <h2>Ingresa a tu cuenta</h2>
            <p className="muted">Entra con el correo que registraste en {company.name}.</p>

            <GoogleButton onCredential={onGoogle} text="continue_with" />

            <div className="divider"><span>o con tu documento</span></div>

            <form onSubmit={requestCode} className="portal-form" noValidate>
              <Select label="Tipo de documento" required value={doc.docType} onChange={(e) => setDoc({ ...doc, docType: e.target.value })} options={DOCS} />
              <Input label="Número de documento" required inputMode="numeric" autoComplete="off" value={doc.docNumber}
                onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })} placeholder="Ej. 1002442323" hint="Te enviaremos un código de 6 dígitos a tu correo registrado." />
              {error && (
                <div className={`notice ${noEmail ? 'notice-warn' : 'notice-bad'}`} role="alert">
                  <p>{error}</p>
                  {noEmail && <p className="small">Cuando lo registren, podrás entrar con Google usando ese correo o con un código que te llegará ahí.</p>}
                </div>
              )}
              <Button type="submit" loading={busy} className="btn-block">Enviarme el código</Button>
            </form>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="portal-form">
            <h2>Escribe tu código</h2>
            <p className="muted">Lo enviamos a <strong>{challenge?.sentTo}</strong>. Vence en {challenge?.expiresInMinutes} minutos. Revisa también la carpeta de spam.</p>
            <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" loading={busy} disabled={code.length !== 6} className="btn-block">Ver mis préstamos</Button>
            <div className="login-links">
              <button type="button" className="link-btn" disabled={wait > 0 || busy} onClick={requestCode}>{wait > 0 ? `Reenviar en ${wait} s` : 'Enviar otro código'}</button>
              <button type="button" className="link-btn" onClick={() => { setStep('start'); setError(''); }}>Volver</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
