import { ApiError } from './client.js';

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
const key = (slug) => `finanpro.portal.${slug}`;

// La sesión del portal vive solo en esta pestaña (sessionStorage) y dura 30 minutos.
export const getPortalToken = (slug) => { try { return sessionStorage.getItem(key(slug)); } catch { return null; } };
export const setPortalToken = (slug, token) => { try { token ? sessionStorage.setItem(key(slug), token) : sessionStorage.removeItem(key(slug)); } catch { /* sin almacenamiento */ } };

// slug null = portal global (/api/portal-global)
export async function portalApi(slug, path = '', { method = 'GET', body } = {}) {
  const token = getPortalToken(slug ?? '__global');
  const url = slug ? `${BASE}/portal/${encodeURIComponent(slug)}${path}` : `${BASE}/portal-global${path}`;
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401) setPortalToken(slug ?? '__global', null);
    throw new ApiError(res.status, data);
  }
  return data;
}
