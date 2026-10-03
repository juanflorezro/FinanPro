import { useCallback, useEffect, useState } from 'react';
import { api } from './client.js';

/** Carga datos de la API y expone reload(). Si path es null no hace nada. */
export function useApi(path, query) {
  const key = path ? path + JSON.stringify(query ?? {}) : null;
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });

  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path, { query });
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
