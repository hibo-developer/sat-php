import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

function crearLocalStorageMock() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function crearCachesMock(entradasIniciales) {
  const caches = new Map(
    Object.entries(entradasIniciales).map(([cacheName, urls]) => [cacheName, urls.map((url) => ({ url }))]),
  );

  return {
    async keys() {
      return Array.from(caches.keys());
    },
    async open(cacheName) {
      if (!caches.has(cacheName)) {
        caches.set(cacheName, []);
      }
      return {
        async keys() {
          return [...(caches.get(cacheName) || [])];
        },
        async delete(request) {
          const items = caches.get(cacheName) || [];
          const restante = items.filter((item) => item.url !== request.url);
          caches.set(cacheName, restante);
          return restante.length !== items.length;
        },
      };
    },
  };
}

describe('sessionCleanupService', () => {
  let db;
  let localStorageMock;
  let cachesMock;

  beforeEach(async () => {
    db = (await import('./offlineDb')).default;
    await Promise.all([
      db.cache_ordenes.clear(),
      db.pending_actions.clear(),
      db.pending_partes.clear(),
      db.pending_gps.clear(),
      db.meta.clear(),
      db.sync_conflicts.clear(),
    ]);

    localStorageMock = crearLocalStorageMock();
    cachesMock = crearCachesMock({
      'sat-app-v2': [
        'https://app.test/api/auth/me',
        'https://app.test/assets/index.js',
      ],
    });

    Object.defineProperty(globalThis, 'window', {
      value: {
        location: { origin: 'https://app.test' },
        localStorage: localStorageMock,
        caches: cachesMock,
      },
      configurable: true,
    });
  });

  it('limpia datos locales sensibles de la sesión y conserva assets cacheados', async () => {
    localStorageMock.setItem('sat_cache_usuario_sat_v1', '{"rol":"admin"}');
    localStorageMock.setItem('sat_cache_parte_borrador_v1', '{"orden_id":"ot-1"}');
    localStorageMock.setItem('otro_valor', 'se-conserva');

    await db.cache_ordenes.put({ id: 'ot-1', estado: 'pendiente' });
    await db.pending_actions.add({ tipo: 'actualizar', ordenId: 'ot-1', createdAt: Date.now() });
    await db.meta.put({ clave: 'ultimaSync', valor: '2026-06-14T10:00:00.000Z' });

    const { limpiarDatosLocalesSesion } = await import('./sessionCleanupService');
    await limpiarDatosLocalesSesion();

    expect(localStorageMock.getItem('sat_cache_usuario_sat_v1')).toBeNull();
    expect(localStorageMock.getItem('sat_cache_parte_borrador_v1')).toBeNull();
    expect(localStorageMock.getItem('otro_valor')).toBe('se-conserva');

    expect(await db.cache_ordenes.count()).toBe(0);
    expect(await db.pending_actions.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);

    const cache = await cachesMock.open('sat-app-v2');
    const urlsRestantes = (await cache.keys()).map((item) => item.url);
    expect(urlsRestantes).toEqual(['https://app.test/assets/index.js']);
  });
});
