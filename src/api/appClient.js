import { ApiError } from './client.js';

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
const ORG_KEY = 'finanpro.org';

let accessToken = null;
let refreshing = null;
let onExpired = () => {};

export const setAppToken = (t) => { accessToken = t; };
export const onAppSessionExpired = (fn) => { onExpired = fn; };
export const getOrgId = () => { try { return localStorage.getItem(ORG_KEY); } catch { return null; } };
export const setOrgId = (id) => { try { id ? localStorage.setItem(ORG_KEY, id) : localStorage.removeItem(ORG_KEY); } catch { /* sin almacenamiento */ } };

async function parse(res) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function refreshAppSession() {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      const body = await parse(res);
      if (!res.ok) throw new ApiError(res.status, body);
      accessToken = body.accessToken;
      return body;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

/** Cliente de la app de empresas: token del usuario + header X-Org-Id de la organización activa. */
export async function appApi(path, { method = 'GET', body, query, headers, retry = true } = {}) {
  const url = new URL(BASE + path);
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const orgId = getOrgId();
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...(orgId && { 'X-Org-Id': orgId }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refreshAppSession();
    } catch {
      accessToken = null;
      onExpired();
      throw new ApiError(401, { message: 'Tu sesión terminó, inicia sesión de nuevo' });
    }
    return appApi(path, { method, body, query, headers, retry: false });
  }
  const data = await parse(res);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
