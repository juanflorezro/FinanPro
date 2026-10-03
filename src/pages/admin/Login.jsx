import { useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../auth/AdminAuth.jsx';
import { Button, Input } from '../../components/ui.jsx';
import { Guilloche } from '../../components/Guilloche.jsx';

function CodeInput({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  const setDigit = (i, d) => {
    const next = digits.map((c, j) => (j === i ? d : c)).join('').replace(/\s+$/, '');
    onChange(next.replace(/ /g, ''));
  };

  return (
    <div className="code-input" role="group" aria-label="Código de 6 dígitos">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d.trim()}
          disabled={disabled}
          aria-label={`Dígito ${i + 1}`}
          autoFocus={i === 0}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) return;
            setDigit(i, v.slice(-1));
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (d.trim()) setDigit(i, ' ');
              else refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (pasted) {
              e.preventDefault();
              onChange(pasted);
              refs.current[Math.min(pasted.length, 5)]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}

export default function AdminLogin() {
  const { admin, ready, startLogin, verifyLogin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('password');
  const [form, setForm] = useState({ email: '', password: '' });
  const [mfaToken, setMfaToken] = useState('');
  const [method, setMethod] = useState('totp');
  const [emailHint, setEmailHint] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && admin) return <Navigate to={location.state?.from ?? '/admin'} replace />;

  async function submitPassword(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await startLogin(form.email.trim(), form.password.trim()); // quita espacios pegados por error
      setMfaToken(res.mfaToken);
      setMethod('totp');
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e, value = code) {
    e?.preventDefault();
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      await verifyLogin(mfaToken, value, method);
      navigate(location.state?.from ?? '/admin', { replace: true });
    } catch (err) {
      setError(err.code === 'MFA_TOKEN_INVALID' ? 'Pasó mucho tiempo. Ingresa tu contraseña de nuevo.' : err.message);
      if (err.code === 'MFA_TOKEN_INVALID') setStep('password');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <aside className="login-brand">
        <Guilloche className="login-rosette" />
        <div className="login-brand-top">
          <span className="logo-mark" aria-hidden="true">F</span>
          <span className="logo-word">FinanPro</span>
        </div>
        <div className="login-brand-copy">
          <p className="login-title">Panel de la plataforma</p>
          <p className="login-lede">Habilita empresas, controla sus suscripciones y dales soporte desde un solo lugar.</p>
        </div>
        <p className="login-foot">Acceso exclusivo para el equipo de FinanPro.</p>
      </aside>

      <main className="login-main">
        {step === 'password' ? (
          <form className="login-form" onSubmit={submitPassword} noValidate>
            <h1>Inicia sesión</h1>
            <p className="muted">Usa la cuenta de administrador que te entregaron.</p>
            <Input label="Correo" type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Contraseña" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" loading={busy} disabled={!form.email || !form.password} className="btn-block">Continuar</Button>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitCode}>
            <h1>Confirma que eres tú</h1>
            <p className="muted">{method === 'totp'
              ? 'Escribe el código de 6 dígitos de tu app de autenticación.'
              : `Te enviamos un código de 6 dígitos a ${emailHint}. Vence en 15 minutos.`}</p>
            <CodeInput value={code} onChange={(v) => { setCode(v); if (v.length === 6) submitCode(null, v); }} disabled={busy} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" loading={busy} disabled={code.length !== 6} className="btn-block">Entrar al panel</Button>
            <div className="login-links">
              <button type="button" className="link-btn" disabled={busy} onClick={async () => {
                setBusy(true); setError('');
                try {
                  const r = await api('/admin/auth/login/email-code', { method: 'POST', body: { mfaToken } });
                  setEmailHint(r.sentTo); setMethod('email'); setCode(''); setTimeout(() => document.querySelector('.code-input input')?.focus(), 50);
                } catch (err) {
                  setError(err.code === 'MFA_TOKEN_INVALID' ? 'Pasó mucho tiempo. Ingresa tu contraseña de nuevo.' : err.message);
                  if (err.code === 'MFA_TOKEN_INVALID') setStep('password');
                } finally { setBusy(false); }
              }}>{method === 'totp' ? 'No tengo la app: enviar código a mi correo' : 'Enviar otro código'}</button>
              {method === 'email' && <button type="button" className="link-btn" onClick={() => { setMethod('totp'); setCode(''); setError(''); }}>Usar la app</button>}
            </div>
            <button type="button" className="link-btn" onClick={() => { setStep('password'); setCode(''); setError(''); }}>Usar otra cuenta</button>
          </form>
        )}
      </main>
    </div>
  );
}
