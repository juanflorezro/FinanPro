import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filtros guardados en la URL: se mantienen al volver atrás, al recargar y se pueden compartir.
 * defaults: { q: '', status: '', ... }. Cambiar un filtro vuelve a la página 1.
 */
export function useUrlFilters(defaults, { limit: defaultLimit = 20 } = {}) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const v = {};
    for (const [k, d] of Object.entries(defaults)) v[k] = params.get(k) ?? d;
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const limit = [10, 20, 50, 100].includes(Number(params.get('por'))) ? Number(params.get('por')) : defaultLimit;

  const update = useCallback((changes, { keepPage = false } = {}) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) {
        if (v === '' || v == null || v === defaults[k]) next.delete(k);
        else next.set(k, String(v));
      }
      if (!keepPage) next.delete('pagina');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setParams]);

  const set = useCallback((k, v) => update({ [k]: v }), [update]);
  const setPage = useCallback((p) => update({ pagina: p > 1 ? p : '' }, { keepPage: true }), [update]);
  const setLimit = useCallback((n) => update({ por: n === defaultLimit ? '' : n }), [update, defaultLimit]);
  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);
  const active = Object.entries(values).filter(([k, v]) => k !== 'sort' && v !== '' && v !== defaults[k]).length;

  return { values, set, update, reset, active, page, setPage, limit, setLimit };
}

/** Paginación en el navegador para listas cortas que ya están cargadas completas. */
export function paginate(items, page, limit) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(page, pages);
  return { rows: items.slice((p - 1) * limit, p * limit), total, page: p };
}
