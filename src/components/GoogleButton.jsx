import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let scriptPromise;

function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Botón oficial de "Continuar con Google". Entrega el idToken a onCredential. */
export function GoogleButton({ onCredential, text = 'continue_with' }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => onCredential(r.credential) });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', text, shape: 'rectangular', logo_alignment: 'left',
        width: Math.min(ref.current.offsetWidth || 380, 400),
      });
    }).catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [onCredential, text]);

  if (!CLIENT_ID) return <p className="field-hint">Falta VITE_GOOGLE_CLIENT_ID en el .env para mostrar el botón de Google.</p>;
  if (failed) return <p className="field-hint">No se pudo cargar el botón de Google. Revisa tu conexión.</p>;
  return <div ref={ref} className="google-btn" />;
}
