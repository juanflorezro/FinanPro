import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { portalApi } from '../../api/portalClient.js';
import { usePortal } from '../PortalLayout.jsx';
import { Button, Input } from '../../components/ui.jsx';
import { CodeInput } from '../../components/CodeInput.jsx';
import { GoogleButton } from '../../components/GoogleButton.jsx';

/** Entrada al portal global: Google o código al correo. El correo debe estar registrado en al menos una empresa. */
export default function GlobalLogin() {
  const { token, signIn } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('start');
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(location.state?.reason ?? '');
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const enter = useCallback((t) => { signIn(t); navigate('/portal/inicio', { replace: true }); }, [signIn, navigate]);
  const fail = (err) => { setNotFound(err.code === 'EMAIL_NOT_REGISTERED'); setError(err.message); };

  const onGoogle = useCallback(async (idToken) => {
    setBusy(true); setError('');
    try { enter((await portalApi(null, '/google', { method: 'POST', body: { idToken } })).token); } catch (err) { fail(err); } finally { setBusy(false); }
  }, [enter]);

  if (token) return <Navigate to="/portal/inicio" replace />;

  async function requestCode(e) {
    e?.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { setError('Escribe un correo válido.'); return; }
    setBusy(true); setError(''); setNotFound(false);
    try {
      setChallenge(await portalApi(null, '/request-code', { method: 'POST', body: { email: value } }));
      setCode(''); setStep('code'); setWait(60);
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setError('');
    try { enter((await portalApi(null, '/verify', { method: 'POST', body: { challengeId: challenge.challengeId, code: value } })).token); } catch (err) { setError(err.message); setCode(''); } finally { setBusy(false); }
  }

  return (
    <div className="portal-login">
      <section className="portal-hero">
        <p className="portal-eyebrow">FinanPro</p>
        <h1>Todo lo que debes, en un solo lugar</h1>
        <p>Entra una vez y mira tus préstamos con todas las empresas que te prestaron: saldos, próximos pagos y lo que ya pagaste.</p>
        <ul className="portal-points">
          <li>Todas tus deudas agrupadas por empresa</li>
          <li>Tu próximo pago, sin importar con quién</li>
          <li>Historial de pagos y estado de cuenta</li>
        </ul>
      </section>

      <div className="portal-card">
        {step === 'start' ? (
          <div className="portal-form">
            <h2>Ingresa con tu correo</h2>
            <p className="muted">Usa el correo que diste a las empresas donde tienes préstamos.</p>
            <GoogleButton onCredential={onGoogle} text="continue_with" />
            <div className="divider"><span>o recibe un código</span></div>
            <form onSubmit={requestCode} className="portal-form" noValidate>
              <Input label="Correo" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@gmail.com" />
              {error && (
                <div className={`notice ${notFound ? 'notice-warn' : 'notice-bad'}`} role="alert">
                  <p>{error}</p>
                  {notFound && <p className="small">Cuando lo registren, entra aquí con Google o con un código a ese correo.</p>}
                </div>
              )}
              <Button type="submit" loading={busy} className="btn-block">Enviarme el código</Button>
            </form>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="portal-form">
            <h2>Escribe tu código</h2>
            <p className="muted">Lo enviamos a <strong>{challenge?.sentTo}</strong>. Vence en {challenge?.expiresInMinutes} minutos. Revisa también spam.</p>
            <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" loading={busy} disabled={code.length !== 6} className="btn-block">Ver mis préstamos</Button>
            <div className="login-links">
              <button type="button" className="link-btn" disabled={wait > 0 || busy} onClick={requestCode}>{wait > 0 ? `Reenviar en ${wait} s` : 'Enviar otro código'}</button>
              <button type="button" className="link-btn" onClick={() => { setStep('start'); setError(''); }}>Cambiar correo</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
