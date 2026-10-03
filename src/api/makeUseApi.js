import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './client.js';

/**
 * Carga datos de la API. Garantías para las pantallas:
 * - Mientras no haya datos ni error, loading es true (nunca data null con loading false).
 * - Si el servidor responde vacío, se muestra como error en vez de romper la pantalla.
 * - Solo cuenta la respuesta más reciente (si cambias filtros rápido no se mezclan).
 */
export function makeUseApi(request) {
  return function useApiHook(path, query) {
    const key = path ? path + JSON.stringify(query ?? {}) : null;
    const [state, setState] = useState({ data: null, error: null, loading: Boolean(path), key: null });
    const seq = useRef(0);

    const load = useCallback(async () => {
      if (!path) return;
      const id = ++seq.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await request(path, { query });
        if (id !== seq.current) return;
        if (data == null) throw new ApiError(500, { message: 'El servidor respondió sin datos. Intenta de nuevo.' });
        setState({ data, error: null, loading: false, key });
      } catch (error) {
        if (id === seq.current) setState({ data: null, error, loading: false, key });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => { load(); }, [load]);
    const waiting = Boolean(path) && state.data == null && !state.error;
    return { data: state.data, error: state.error, loading: state.loading || waiting, reload: load };
  };
}
