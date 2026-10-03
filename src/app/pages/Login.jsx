import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { appApi } from '../../api/appClient.js';
import { useAppAuth } from '../AppAuth.jsx';
import { Button, Input } from '../../components/ui.jsx';
import { CodeInput } from '../../components/CodeInput.jsx';
import { GoogleButton } from '../../components/GoogleButton.jsx';
import { Guilloche } from '../../components/Guilloche.jsx';

export function AuthShell({ title, lede, children }) {
  return (
    <div className="login">
      <aside className="login-brand">
        <Guilloche className="login-rosette" />
        <div className="login-brand-top">
          <span className="logo-mark" aria-hidden="true">F</span>
          <span className="logo-word">FinanPro</span>
        </div>
        <div className="login-brand-copy">
          <p className="login-title">{title}</p>
          <p className="login-lede">{lede}</p>
        </div>
        <p className="login-foot">Solo pueden entrar correos habilitados por FinanPro o invitados por una empresa.</p>
      </aside>
      <main className="login-main">{children}</main>
    </div>
  );
}

export default function Login() {
  const { me, ready, acceptSession } = useAppAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');          // login | register
  const [step, setStep] = useState('form');           // form | code
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [challenge, setChallenge] = useState(null);   // { mfaToken, method, emailHint }
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = useCallback(async (session) => {
    await acceptSession(session);
    navigate('/', { replace: true });
  }, [acceptSession, navigate]);

  const handle = useCallback(async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }, []);

  const onGoogle = useCallback((idToken) => handle(async () => {
    const res = await appApi('/auth/google', { method: 'POST', body: { idToken } });
    if (res.mfaRequired) { setChallenge(res); setStep('code'); setMode('login'); return; }
    await finish(res);
  }), [handle, finish]);

  if (ready && me) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const email = form.email.trim().toLowerCase();

  async function submitForm(e) {
    e.preventDefault();
    await handle(async () => {
      if (mode === 'login') {
        const res = await appApi('/auth/login', { method: 'POST', body: { email, password: form.password } });
        setChallenge(res);
      } else {
        await appApi('/auth/register/start', { method: 'POST', body: { email } });
        setChallenge({ method: 'register', emailHint: email });
      }
      setCode('');
      setStep('code');
    });
  }

  async function submitCode(value = code) {
    if (value.length !== 6 || busy) return;
    await handle(async () => {
      if (challenge.method === 'register') {
        await finish(await appApi('/auth/register/complete', { method: 'POST', body: { email, code: value, password: form.password, name: form.name.trim() } }));
      } else {
        await finish(await appApi('/auth/login/verify', { method: 'POST', body: { mfaToken: challenge.mfaToken, code: value } }));
      }
    }).finally(() => setCode(''));
  }

  async function resend() {
    await handle(async () => {
      if (challenge.method === 'register') await appApi('/auth/register/start', { method: 'POST', body: { email } });
      else await appApi('/auth/login/resend', { method: 'POST', body: { mfaToken: challenge.mfaToken } });
      setInfo('Te enviamos un código nuevo.');
    });
  }

  if (step === 'code') {
    const viaApp = challenge?.method === 'totp';
    return (
      <AuthShell title="Tu cartera, al día" lede="Préstamos, cuotas, pagos y mora de tu empresa en un solo lugar.">
        <form className="login-form" onSubmit={(e) => { e.preventDefault(); submitCode(); }}>
          <h1>{challenge.method === 'register' ? 'Confirma tu correo' : 'Confirma que eres tú'}</h1>
          <p className="muted">{viaApp ? 'Escribe el código de 6 dígitos de tu app de autenticación. También sirve un código de respaldo.' : `Te enviamos un código de 6 dígitos a ${challenge.emailHint}.`}</p>
          {viaApp
            ? <Input label="Código" value={code} onChange={(e) => setCode(e.target.value.trim())} autoFocus autoComplete="one-time-code" />
            : <CodeInput value={code} onChange={setCode} onComplete={submitCode} disabled={busy} />}
          {error && <p className="form-error" role="alert">{error}</p>}
          {info && !error && <p className="field-hint">{info}</p>}
          <Button type="submit" loading={busy} disabled={code.length < 6} className="btn-block">
            {challenge.method === 'register' ? 'Crear mi cuenta' : 'Entrar'}
          </Button>
          <div className="login-links">
            {!viaApp && <button type="button" className="link-btn" onClick={resend} disabled={busy}>Enviar otro código</button>}
            <button type="button" className="link-btn" onClick={() => { setStep('form'); setError(''); setInfo(''); }}>Volver</button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Tu cartera, al día" lede="Préstamos, cuotas, pagos y mora de tu empresa en un solo lugar.">
      <form className="login-form" onSubmit={submitForm} noValidate>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setError(''); }}>Crear cuenta</button>
        </div>
        <GoogleButton onCredential={onGoogle} text={mode === 'login' ? 'signin_with' : 'signup_with'} />
        <div className="divider"><span>o con tu correo</span></div>
        {mode === 'register' && <Input label="Tu nombre" value={form.name} onChange={set('name')} autoComplete="name" />}
        <Input label="Correo" type="email" autoComplete="username" value={form.email} onChange={set('email')} />
        <Input label="Contraseña" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')}
          hint={mode === 'register' ? 'Mínimo 8 caracteres' : undefined} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="btn-block"
          disabled={!email || !form.password || (mode === 'register' && (form.password.length < 8 || form.name.trim().length < 2))}>
          {mode === 'login' ? 'Continuar' : 'Enviarme el código'}
        </Button>
        {mode === 'login' && <Link to="/recuperar" className="login-aside-link">Olvidé mi contraseña</Link>}
        {mode === 'register' && <p className="field-hint">Solo funciona con un correo que FinanPro habilitó o al que una empresa invitó.</p>}
      </form>
    </AuthShell>
  );
}
