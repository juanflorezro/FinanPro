import { useCallback, useEffect, useState } from 'react';
import { appApi } from './appClient.js';

export function useAppApi(path, query) {
  const key = path ? path + JSON.stringify(query ?? {}) : null;
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await appApi(path, { query }), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
