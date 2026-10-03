import { useState } from 'react';
import { useToast } from './Toast.jsx';

/** Ejecuta una acción con estado de carga, muestra el resultado y devuelve true si salió bien. */
export function useAction() {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (successMessage) notify(successMessage);
      return result ?? true;
    } catch (err) {
      setError(err);
      notify(err.message, 'bad');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, setError };
}
