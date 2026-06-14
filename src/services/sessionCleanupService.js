import db from './offlineDb';
import { getApiBaseUrl } from './apiClient';

const STORAGE_KEY_PREFIX = 'sat_cache_';

function esStorageDisponible() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function listarClavesSesionLocal() {
  if (!esStorageDisponible()) return [];
  const claves = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const clave = window.localStorage.key(i);
    if (clave && clave.startsWith(STORAGE_KEY_PREFIX)) {
      claves.push(clave);
    }
  }
  return claves;
}

function limpiarLocalStorageSesion() {
  if (!esStorageDisponible()) return;
  listarClavesSesionLocal().forEach((clave) => {
    try {
      window.localStorage.removeItem(clave);
    } catch {
      // noop
    }
  });
}

function obtenerPrefijoApi() {
  if (typeof window === 'undefined') return null;
  try {
    const apiUrl = new URL(getApiBaseUrl(), window.location.origin);
    if (apiUrl.origin !== window.location.origin) {
      return null;
    }
    return apiUrl.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

async function limpiarCachesHttpApi() {
  if (typeof window === 'undefined' || typeof window.caches === 'undefined') return;
  const apiPrefix = obtenerPrefijoApi();
  if (!apiPrefix) return;

  const cacheNames = await window.caches.keys();
  await Promise.allSettled(
    cacheNames.map(async (cacheName) => {
      const cache = await window.caches.open(cacheName);
      const requests = await cache.keys();
      const requestsApi = requests.filter((request) => {
        try {
          const url = new URL(request.url);
          return url.origin === window.location.origin && url.pathname.startsWith(apiPrefix);
        } catch {
          return false;
        }
      });
      await Promise.allSettled(requestsApi.map((request) => cache.delete(request)));
    }),
  );
}

async function limpiarDexieSesion() {
  const tablas = [
    db.cache_ordenes,
    db.pending_actions,
    db.pending_partes,
    db.pending_gps,
    db.sync_conflicts,
    db.meta,
  ].filter(Boolean);

  await Promise.allSettled(tablas.map((tabla) => tabla.clear()));
}

export async function limpiarDatosLocalesSesion() {
  limpiarLocalStorageSesion();
  await Promise.allSettled([
    limpiarCachesHttpApi(),
    limpiarDexieSesion(),
  ]);
}
