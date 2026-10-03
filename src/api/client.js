const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? 'No se pudo completar la acción');
    this.status = status;
    this.code = body?.error;
    this.details = body?.details;
  }
}

let accessToken = null;
let refreshing = null;
let onSessionChange = () => {};

export const setAccessToken = (token) => { accessToken = token; };
export const onAdminSession = (fn) => { onSessionChange = fn; };

async function parse(res) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function refreshAdminSession() {
  refreshing ??= fetch(`${BASE}/admin/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      const body = await parse(res);
      if (!res.ok) throw new ApiError(res.status, body);
      accessToken = body.accessToken;
      onSessionChange(body.admin);
      return body;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * Llama a la API del panel. Si el token venció, lo renueva una vez y repite la petición.
 * api('/admin/tenants', { query: { page: 1 } })  ·  api('/admin/plans', { method: 'POST', body })
 */
export async function api(path, { method = 'GET', body, query, retry = true } = {}) {
  const url = new URL(BASE + path);
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && !path.startsWith('/admin/auth/')) {
    try {
      await refreshAdminSession();
    } catch {
      accessToken = null;
      onSessionChange(null);
      throw new ApiError(401, { message: 'Tu sesión terminó, inicia sesión de nuevo' });
    }
    return api(path, { method, body, query, retry: false });
  }

  const data = await parse(res);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
