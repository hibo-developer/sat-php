const runtimeConfig =
  typeof window !== 'undefined' && window.__APP_CONFIG__ ? window.__APP_CONFIG__ : null;

const apiBaseUrl = runtimeConfig?.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '/api';
const cacheSignedUrls = new Map();

let csrfToken = '';

export function getApiBaseUrl() {
  return String(apiBaseUrl || '/api').replace(/\/+$/, '');
}

export function setCsrfToken(token) {
  csrfToken = String(token || '').trim();
}

export function getCsrfToken() {
  return csrfToken;
}

async function leerJsonSeguro(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchJson(path, opciones = {}) {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  const method = (opciones.method || 'GET').toUpperCase();
  const headers = new Headers(opciones.headers || {});

  const usarCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken;
  if (usarCsrf) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  if (opciones.body && !(opciones.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    method,
    headers,
    body: opciones.body
      ? (opciones.body instanceof FormData ? opciones.body : JSON.stringify(opciones.body))
      : undefined,
    credentials: 'include',
  });

  const data = await leerJsonSeguro(res);

  if (!res.ok) {
    const msg = (data && typeof data.error === 'string' && data.error) || `Error HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function obtenerUrlFirmadaStorageApi(ref, opciones = {}) {
  const { expiresIn = 600 } = opciones;
  const key = `${ref.bucket}/${ref.path}`;
  const ahora = Date.now();
  const cached = cacheSignedUrls.get(key);
  if (cached && cached.url && cached.expiresAt && cached.expiresAt > ahora + 15_000) {
    return cached.url;
  }

  const data = await fetchJson('/storage-signed-url', {
    method: 'POST',
    body: {
      bucket: ref.bucket,
      path: ref.path,
      expiresIn: Math.max(60, Math.min(3600, Number(expiresIn) || 600)),
    },
  });

  const url = data?.url ? String(data.url) : '';
  if (!url) return '';

  const expMs = (Math.max(60, Math.min(3600, Number(expiresIn) || 600)) * 1000);
  cacheSignedUrls.set(key, { url, expiresAt: ahora + expMs });
  return url;
}

