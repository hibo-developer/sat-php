import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./workOrderApiService', () => ({
  actualizarOrdenTrabajo: vi.fn(async () => ({})),
  eliminarOrdenTrabajo: vi.fn(async () => ({})),
}));

const crearParteTrabajoMock = vi.fn(async () => ({}));

vi.mock('./parteTrabajoService', () => ({
  crearParteTrabajo: (...args) => crearParteTrabajoMock(...args),
}));

vi.mock('./ordenGpsService', () => ({
  insertarPuntoGps: vi.fn(async () => ({})),
}));

describe('offlineSyncService', () => {
  let db;
  let offlineSync;

  beforeEach(async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });
    db = (await import('./offlineDb')).default;
    await Promise.all([
      db.cache_ordenes.clear(),
      db.pending_actions.clear(),
      db.pending_partes.clear(),
      db.pending_gps.clear(),
      db.meta.clear(),
      db.sync_conflicts.clear(),
    ]);
    crearParteTrabajoMock.mockClear();
    offlineSync = await import('./offlineSyncService');
  });

  it('encola un parte offline y lo sincroniza al volver internet', async () => {
    await offlineSync.encolarParteFinalizado({
      payload: {
        orden_id: 'ot-1',
        tareas_realizadas: 'Parte registrado desde movilidad',
      },
      fotos: [],
      firmaDataUrl: '',
      contexto: {},
    });

    expect(await offlineSync.contarPartesPendientes()).toBe(1);

    await offlineSync.procesarColaPartes();
    expect(await offlineSync.contarPartesPendientes()).toBe(1);

    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
    });

    await offlineSync.procesarColaPartes();
    expect(await offlineSync.contarPartesPendientes()).toBe(0);
    expect(crearParteTrabajoMock).toHaveBeenCalledTimes(1);
  });

  it('deduplica acciones de actualización por OT', async () => {
    await offlineSync.encolarAccion({ tipo: 'actualizar', ordenId: 'ot-1', payload: { estado: 'pendiente' } });
    await offlineSync.encolarAccion({ tipo: 'actualizar', ordenId: 'ot-1', payload: { prioridad: 'urgente' } });
    expect(await offlineSync.contarPendientes()).toBe(1);
  });

  it('descarta partes pendientes con error 400 para no reintentarlos en bucle', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
    });
    crearParteTrabajoMock.mockRejectedValueOnce(Object.assign(new Error('El técnico seleccionado está inactivo.'), { status: 400 }));

    await offlineSync.encolarParteFinalizado({
      payload: {
        orden_id: 'ot-2',
        tecnico_id: 'tec-inactivo',
      },
      fotos: [],
      firmaDataUrl: 'data:image/png;base64,AA==',
      contexto: {},
    });

    const resultado = await offlineSync.procesarColaPartes();

    expect(resultado.procesados).toBe(1);
    expect(resultado.huboError).toBe(false);
    expect(await offlineSync.contarPartesPendientes()).toBe(0);
    expect(await db.sync_conflicts.count()).toBe(1);
  });
});
