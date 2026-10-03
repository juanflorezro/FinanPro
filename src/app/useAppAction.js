import { useState } from 'react';
import { useToast } from '../components/Toast.jsx';

/** Igual que useAction, pero devuelve también el error para manejar casos especiales (ej. aviso de tasa). */
export function useAppAction() {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  async function run(fn, successMessage, { silentCodes = [] } = {}) {
    setBusy(true);
    try {
      const result = await fn();
      if (successMessage) notify(successMessage);
      return { ok: true, result };
    } catch (error) {
      if (!silentCodes.includes(error.code)) notify(error.message, 'bad');
      return { ok: false, error };
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}
