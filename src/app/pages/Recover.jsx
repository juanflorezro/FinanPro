import { useState } from 'react';
import { Link } from 'react-router-dom';
import { appApi } from '../../api/appClient.js';
import { Button, Input } from '../../components/ui.jsx';
import { CodeInput } from '../../components/CodeInput.jsx';
import { AuthShell } from './Login.jsx';

export default function Recover() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Recupera tu acceso" lede="Te enviamos un código a tu correo para crear una contraseña nueva.">
      {step === 'email' && (
        <form className="login-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await appApi('/auth/password/forgot', { method: 'POST', body: { email: email.trim() } }); setStep('code'); }); }}>
          <h1>Olvidé mi contraseña</h1>
          <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" loading={busy} disabled={!email} className="btn-block">Enviarme el código</Button>
          <Link to="/login" className="login-aside-link">Volver a entrar</Link>
        </form>
      )}
      {step === 'code' && (
        <form className="login-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await appApi('/auth/password/reset', { method: 'POST', body: { email: email.trim(), code, password } }); setStep('done'); }); }}>
          <h1>Crea tu contraseña nueva</h1>
          <p className="muted">Si el correo existe, te llegó un código de 6 dígitos.</p>
          <CodeInput value={code} onChange={setCode} disabled={busy} />
          <Input label="Contraseña nueva" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="Mínimo 8 caracteres" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" loading={busy} disabled={code.length !== 6 || password.length < 8} className="btn-block">Cambiar contraseña</Button>
        </form>
      )}
      {step === 'done' && (
        <div className="login-form">
          <h1>Listo</h1>
          <p className="muted">Tu contraseña cambió y cerramos tus sesiones abiertas. Entra de nuevo con la nueva.</p>
          <Link to="/login" className="btn btn-primary btn-block">Ir a entrar</Link>
        </div>
      )}
    </AuthShell>
  );
}
