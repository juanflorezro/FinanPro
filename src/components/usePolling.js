import { useEffect, useRef } from 'react';

/**
 * Llama fn al montar y cada `ms` mientras la pestaña está visible.
 * No encadena peticiones (si una tarda, no lanza otra encima) y se detiene al salir de la página.
 */
export function usePolling(fn, ms, deps) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    let running = false;
    const tick = async () => {
      if (!alive || running || document.visibilityState !== 'visible') return;
      running = true;
      try { await fnRef.current(); } catch { /* el componente muestra el error */ } finally { running = false; }
    };
    tick();
    const t = setInterval(tick, ms);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
