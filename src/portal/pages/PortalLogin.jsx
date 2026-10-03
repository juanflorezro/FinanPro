import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { portalApi } from '../../api/portalClient.js';
import { usePortal } from '../PortalLayout.jsx';
import { Button, Input, Select } from '../../components/ui.jsx';
import { CodeInput } from '../../components/CodeInput.jsx';

const DOCS = { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', PPT: 'Permiso por protección temporal', PAS: 'Pasaporte', NIT: 'NIT' };

export default function PortalLogin() {
  const { slug, company, token, signIn } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('doc');
  const [doc, setDoc] = useState({ docType: 'CC', docNumber: '' });
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(location.state?.reason ?? '');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (token) return <Navigate to={`/p/${slug}/inicio`} replace />;

  async function requestCode(e) {
    e?.preventDefault();
    const number = doc.docNumber.replace(/[.\s]/g, '');
    if (!/^[0-9A-Za-z-]{4,20}$/.test(number)) { setError('Escribe tu número de documento sin puntos ni espacios.'); return; }
    setBusy(true); setError('');
    try {
      const r = await portalApi(slug, '/request-code', { method: 'POST', body: { docType: doc.docType, docNumber: number } });
      setChallenge(r); setCode(''); setStep('code'); setWait(60);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function verifyWithDoc(value = code) {
    const number = doc.docNumber.replace(/[.\s]/g, '');
    if (!/^[0-9A-Za-z-]{4,20}$/.test(number)) { setError('Escribe tu número de documento sin puntos ni espacios.'); return; }
    if (value.length !== 6 || busy) return;
    setBusy(true); setError('');
    try {
      const r = await portalApi(slug, '/verify-doc', { method: 'POST', body: { docType: doc.docType, docNumber: number, code: value } });
      signIn(r.token);
      navigate(`/p/${slug}/inicio`, { replace: true });
    } catch (err) { setError(err.message); setCode(''); } finally { setBusy(false); }
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setError('');
    try {
      const r = await portalApi(slug, '/verify', { method: 'POST', body: { challengeId: challenge.challengeId, code: value } });
      signIn(r.token);
      navigate(`/p/${slug}/inicio`, { replace: true });
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
        {step === 'doc' ? (
          <form onSubmit={requestCode} className="portal-form" noValidate>
            <h2>Ingresa con tu documento</h2>
            <p className="muted">Te enviaremos un código de 6 dígitos al correo o celular que registraste con {company.name}.</p>
            <Select label="Tipo de documento" required value={doc.docType} onChange={(e) => setDoc({ ...doc, docType: e.target.value })} options={DOCS} />
            <Input label="Número de documento" required inputMode="numeric" autoComplete="off" value={doc.docNumber}
              onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })} placeholder="Ej. 1002442323" hint="Sin puntos ni espacios" />
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" loading={busy} className="btn-block">Enviarme el código</Button>
            <button type="button" className="link-btn" onClick={() => { setStep('manual'); setCode(''); setError(''); }}>Ya tengo un código que me dio {company.name}</button>
          </form>
        ) : step === 'manual' ? (
          <form onSubmit={(e) => { e.preventDefault(); verifyWithDoc(); }} className="portal-form" noValidate>
            <h2>Ingresa con tu código</h2>
            <p className="muted">Escribe tu documento y el código de 6 dígitos que te compartió {company.name}. Sirve por 60 minutos.</p>
            <Select label="Tipo de documento" required value={doc.docType} onChange={(e) => setDoc({ ...doc, docType: e.target.value })} options={DOCS} />
            <Input label="Número de documento" required inputMode="numeric" autoComplete="off" value={doc.docNumber}
              onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })} placeholder="Ej. 1002442323" />
            <div className="field"><label>Código <span className="req">*</span></label><CodeInput value={code} onChange={setCode} disabled={busy} /></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" loading={busy} disabled={code.length !== 6} className="btn-block">Ver mis préstamos</Button>
            <button type="button" className="link-btn" onClick={() => { setStep('doc'); setCode(''); setError(''); }}>Prefiero recibir el código por correo</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="portal-form">
            <h2>Escribe tu código</h2>
            <p className="muted">
              {challenge?.sentTo
                ? <>Lo enviamos a {challenge.sentTo}. Vence en {challenge.expiresInMinutes} minutos.</>
                : <>Si tu documento está registrado y tiene correo, te enviamos un código. Si no te llega en unos minutos, pide a {company.name} un código de acceso.</>}
            </p>
            <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" loading={busy} disabled={code.length !== 6} className="btn-block">Ver mis préstamos</Button>
            <div className="login-links">
              <button type="button" className="link-btn" disabled={wait > 0 || busy} onClick={requestCode}>{wait > 0 ? `Reenviar en ${wait} s` : 'Enviar otro código'}</button>
              <button type="button" className="link-btn" onClick={() => { setStep('doc'); setError(''); }}>Cambiar documento</button>
            </div>
            <button type="button" className="link-btn" onClick={() => { setStep('manual'); setCode(''); setError(''); }}>La empresa me dio un código</button>
            <p className="field-hint">¿No te llega? Revisa la carpeta de spam o pide a {company.name} un código de acceso.</p>
          </form>
        )}
      </div>
    </div>
  );
}
