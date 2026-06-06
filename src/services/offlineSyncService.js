// =====================================================================
// Servicio de sincronización offline-first.
//
// Estrategia:
// - Las lecturas usan caché local IndexedDB (Dexie). Cuando hay red, el
//   hook hace un fetch al backend en background y refresca la caché.
// - Las escrituras se intentan online primero. Si falla por red u offline,
//   se encolan en `pending_actions` y la UI sigue funcionando con datos
//   optimistas. Al volver la conexión se procesa la cola.
//
// Acciones soportadas en cola (v1):
//  - actualizar  : actualizar campos editables de una orden (no finalizadas)
//  - eliminar    : borrado lógico/físico de una orden
//
// Las acciones que requieren subir ficheros (fotos, firma, PDF) se mantienen
// online-only para evitar perder evidencias. El indicador UI lo refleja.
// =====================================================================

import db from './offlineDb';
import {
  actualizarOrdenTrabajo,
  eliminarOrdenTrabajo,
} from './workOrderService';
import { crearParteTrabajo } from './parteTrabajoService';
import { insertarPuntoGps } from './ordenGpsService';

const ACCIONES_SOPORTADAS = new Set(['actualizar', 'eliminar']);

const oyentes = new Set();
let syncTimer = null;
let backoffMs = 0;

function notificar() {
  Promise.all([contarPendientes(), contarPartesPendientes(), contarGpsPendientes()])
    .then(([acciones, partes, gps]) => {
      const total = acciones + partes + gps;
      oyentes.forEach((cb) => {
        try {
          cb({
            pendientes: total,
            pendientesAcciones: acciones,
            pendientesPartes: partes,
            pendientesGps: gps,
            online: estaOnline(),
          });
        } catch { /* noop */ }
      });
    })
    .catch(() => { /* noop */ });
}

export function suscribirseEstadoSync(callback) {
  oyentes.add(callback);
  notificar();
  return () => { oyentes.delete(callback); };
}

export function estaOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function cancelarTimerSync() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

async function programarSync({ force = false } = {}) {
  if (!estaOnline()) return;
  const [acciones, partes, gps] = await Promise.all([contarPendientes(), contarPartesPendientes(), contarGpsPendientes()]);
  if (acciones + partes + gps === 0) {
    backoffMs = 0;
    cancelarTimerSync();
    return;
  }
  if (syncTimer && !force) return;
  cancelarTimerSync();
  const espera = force ? 0 : backoffMs;
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    if (!estaOnline()) return;
    const [rspAcciones, rspPartes, rspGps] = await Promise.allSettled([procesarCola(), procesarColaPartes(), procesarColaGps()]);
    const huboError = [rspAcciones, rspPartes, rspGps].some((rsp) => (
      rsp.status !== 'fulfilled' || Boolean(rsp.value?.huboError)
    ));
    const progreso = [rspAcciones, rspPartes, rspGps].some((rsp) => (
      rsp.status === 'fulfilled'
        && (
          (rsp.value?.procesadas || 0) > 0
          || (rsp.value?.procesados || 0) > 0
        )
    ));
    const restantes = await Promise.all([contarPendientes(), contarPartesPendientes(), contarGpsPendientes()]).then(
      ([a, p, g]) => a + p + g,
    );
    if (restantes === 0) {
      backoffMs = 0;
      return;
    }
    if (progreso && !huboError) {
      backoffMs = 0;
    } else {
      backoffMs = backoffMs ? Math.min(60000, backoffMs * 2) : 5000;
    }
    programarSync().catch(() => { /* noop */ });
  }, espera);
}

// ---------------------------------------------------------------------
// Caché de lectura
// ---------------------------------------------------------------------

export async function reemplazarCacheOrdenes(ordenes) {
  if (!Array.isArray(ordenes)) return;
  const corte = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const ordenesRecientes = ordenes.filter((o) => {
    const fecha = o?.fecha_inicio ? new Date(o.fecha_inicio).getTime() : null;
    if (!Number.isFinite(fecha)) return true;
    return fecha >= corte;
  });
  await db.transaction('rw', db.cache_ordenes, db.meta, async () => {
    await db.cache_ordenes.clear();
    if (ordenesRecientes.length) {
      await db.cache_ordenes.bulkPut(
        ordenesRecientes.map((o) => ({ ...o, updated_at: o.updated_at || new Date().toISOString() })),
      );
    }
    await db.meta.put({ clave: 'ultimaSync', valor: new Date().toISOString() });
  });
}

export async function obtenerOrdenesCacheadas() {
  try {
    return await db.cache_ordenes.toArray();
  } catch {
    return [];
  }
}

async function obtenerOrdenCacheadaPorId(ordenId) {
  try {
    return await db.cache_ordenes.get(ordenId);
  } catch {
    return null;
  }
}

export async function obtenerUltimaSincronizacion() {
  try {
    const meta = await db.meta.get('ultimaSync');
    return meta?.valor || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Cola de mutaciones
// ---------------------------------------------------------------------

export async function encolarAccion({ tipo, ordenId, payload }) {
  if (!ACCIONES_SOPORTADAS.has(tipo)) {
    throw new Error(`Acción "${tipo}" no soportada en modo offline.`);
  }
  const ahoraIso = new Date().toISOString();
  const base = tipo === 'actualizar' ? await obtenerOrdenCacheadaPorId(ordenId) : null;
  const baseUpdatedAt = base?.updated_at || null;
  await db.transaction('rw', db.pending_actions, async () => {
    if (tipo === 'eliminar') {
      const existentes = await db.pending_actions.where('ordenId').equals(ordenId).toArray();
      if (existentes.length) {
        await db.pending_actions.bulkDelete(existentes.map((e) => e.id));
      }
      await db.pending_actions.add({
        tipo,
        ordenId,
        payload: null,
        createdAt: ahoraIso,
        baseUpdatedAt,
        clientUpdatedAt: ahoraIso,
      });
      return;
    }

    const existente = await db.pending_actions
      .where('ordenId')
      .equals(ordenId)
      .filter((item) => item.tipo === 'actualizar')
      .first();
    if (existente) {
      await db.pending_actions.update(existente.id, {
        payload: { ...(existente.payload || {}), ...(payload || {}) },
        baseUpdatedAt: existente.baseUpdatedAt || baseUpdatedAt,
        clientUpdatedAt: ahoraIso,
      });
      return;
    }

    await db.pending_actions.add({
      tipo,
      ordenId,
      payload: payload ?? null,
      createdAt: ahoraIso,
      baseUpdatedAt,
      clientUpdatedAt: ahoraIso,
    });
  });
  notificar();
  programarSync().catch(() => { /* noop */ });
}

export async function contarPendientes() {
  try {
    return await db.pending_actions.count();
  } catch {
    return 0;
  }
}

export async function listarPendientes() {
  try {
    return await db.pending_actions.orderBy('id').toArray();
  } catch {
    return [];
  }
}

let procesandoCola = false;

async function registrarConflicto({ ordenId, tipo, baseUpdatedAt, remoteUpdatedAt, clientUpdatedAt, payload, resolucion, motivo }) {
  try {
    await db.sync_conflicts.add({
      ordenId,
      tipo,
      baseUpdatedAt: baseUpdatedAt || null,
      remoteUpdatedAt: remoteUpdatedAt || null,
      clientUpdatedAt: clientUpdatedAt || null,
      payload: payload || null,
      resolucion: resolucion || null,
      motivo: motivo || null,
      createdAt: new Date().toISOString(),
    });
  } catch { /* noop */ }
}

function parseMs(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function clasificarError(err) {
  const status = err?.status || err?.cause?.status || null;
  if (!estaOnline()) return { kind: 'network', retryable: true, status };
  if (status === 401 || status === 403) return { kind: 'auth', retryable: false, status };
  if (typeof status === 'number' && status >= 500) return { kind: 'server', retryable: true, status };
  if (typeof status === 'number' && status >= 400) return { kind: 'client', retryable: false, status };
  if (esErrorRed(err)) return { kind: 'network', retryable: true, status };
  return { kind: 'unknown', retryable: false, status };
}

async function ejecutarAccionRemota(accion) {
  if (accion.tipo === 'actualizar') {
    const baseUpdatedAt = accion.baseUpdatedAt || null;
    if (baseUpdatedAt) {
      const remoto = await obtenerOrdenTrabajoActualizadaAt(accion.ordenId);
      const remotoUpdatedAt = remoto?.updated_at || null;
      if (remotoUpdatedAt && remotoUpdatedAt !== baseUpdatedAt) {
        const msRemoto = parseMs(remotoUpdatedAt);
        const msLocal = parseMs(accion.clientUpdatedAt);
        if (msRemoto !== null && msLocal !== null && msRemoto > msLocal) {
          await registrarConflicto({
            ordenId: accion.ordenId,
            tipo: accion.tipo,
            baseUpdatedAt,
            remoteUpdatedAt: remotoUpdatedAt,
            clientUpdatedAt: accion.clientUpdatedAt,
            payload: accion.payload,
            resolucion: 'remote_wins',
            motivo: 'updated_at_remote_mas_reciente',
          });
          return { skip: true };
        }
        await registrarConflicto({
          ordenId: accion.ordenId,
          tipo: accion.tipo,
          baseUpdatedAt,
          remoteUpdatedAt: remotoUpdatedAt,
          clientUpdatedAt: accion.clientUpdatedAt,
          payload: accion.payload,
          resolucion: 'local_wins',
          motivo: 'updated_at_local_mas_reciente',
        });
      }
    }
    await actualizarOrdenTrabajo(accion.ordenId, accion.payload || {}, { expectedUpdatedAt: baseUpdatedAt });
    return;
  }
  if (accion.tipo === 'eliminar') {
    await eliminarOrdenTrabajo(accion.ordenId);
    return;
  }
  throw new Error(`Acción "${accion.tipo}" desconocida.`);
}

export async function procesarCola() {
  if (procesandoCola || !estaOnline()) {
    return { procesadas: 0, restantes: await contarPendientes(), huboError: false };
  }
  procesandoCola = true;
  let procesadas = 0;
  let huboError = false;

  try {
    const pendientes = await listarPendientes();
    for (const accion of pendientes) {
      try {
        const rsp = await ejecutarAccionRemota(accion);
        if (rsp?.skip) {
          await db.pending_actions.delete(accion.id);
          procesadas += 1;
          continue;
        }
        await db.pending_actions.delete(accion.id);
        procesadas += 1;
      } catch (err) {
        const info = clasificarError(err);
        if (!info.retryable) {
          await registrarConflicto({
            ordenId: accion.ordenId,
            tipo: accion.tipo,
            baseUpdatedAt: accion.baseUpdatedAt,
            remoteUpdatedAt: null,
            clientUpdatedAt: accion.clientUpdatedAt,
            payload: accion.payload,
            resolucion: 'discarded',
            motivo: err?.message || String(err),
          });
          await db.pending_actions.delete(accion.id);
          procesadas += 1;
          continue;
        }
        huboError = true;
        break;
      }
    }
  } finally {
    procesandoCola = false;
    notificar();
  }

  const restantes = await contarPendientes();
  if (restantes > 0) {
    programarSync().catch(() => { /* noop */ });
  }
  return { procesadas, restantes, huboError };
}

// ---------------------------------------------------------------------
// Wrappers que la UI puede usar como "intent": online si se puede, encolar si no.
// ---------------------------------------------------------------------

export async function intentarActualizarOrden(idOrden, datos) {
  if (estaOnline()) {
    try {
      const resultado = await actualizarOrdenTrabajo(idOrden, datos);
      // Aprovechamos para drenar lo que pudiera quedar pendiente.
      procesarCola().catch(() => { /* noop */ });
      return { offline: false, resultado };
    } catch (err) {
      // Si el error es claramente de red, encolamos. Si es validación, propagamos.
      if (esErrorRed(err)) {
        await encolarAccion({ tipo: 'actualizar', ordenId: idOrden, payload: datos });
        return { offline: true };
      }
      throw err;
    }
  }
  await encolarAccion({ tipo: 'actualizar', ordenId: idOrden, payload: datos });
  return { offline: true };
}

export async function intentarEliminarOrden(idOrden) {
  if (estaOnline()) {
    try {
      const resultado = await eliminarOrdenTrabajo(idOrden);
      procesarCola().catch(() => { /* noop */ });
      return { offline: false, resultado };
    } catch (err) {
      if (esErrorRed(err)) {
        await encolarAccion({ tipo: 'eliminar', ordenId: idOrden });
        return { offline: true };
      }
      throw err;
    }
  }
  await encolarAccion({ tipo: 'eliminar', ordenId: idOrden });
  return { offline: true };
}

function esErrorRed(err) {
  if (!err) return false;
  const mensaje = String(err.message || err?.cause?.message || err).toLowerCase();
  return (
    mensaje.includes('failed to fetch')
    || mensaje.includes('networkerror')
    || mensaje.includes('network error')
    || mensaje.includes('load failed')
    || mensaje.includes('fetch failed')
    || mensaje.includes('timeout')
    || mensaje.includes('offline')
  );
}

// =====================================================================
// Cola de partes finalizados completos
// =====================================================================
//
// Un parte finalizado offline guarda en IndexedDB:
//  - payload del formulario (texto/IDs)
//  - desplazamiento, intervension (objetos JSON)
//  - materialesSeleccionados (array)
//  - fotos (array de Blobs)
//  - firmaDataUrl (string base64)
//  - contexto: nombres de cliente/equipo/técnico para regenerar el informe
//
// Al sincronizar se reproduce el flujo: crearParteTrabajo →
// generarYSubirInformeParte → guardarInformePdfUrl.
//
// Las acciones que soporten subir Blobs requieren que IndexedDB pueda
// almacenarlos: Dexie/IDB lo soportan de forma nativa.

export async function encolarParteFinalizado(parteCompleto) {
  if (!parteCompleto || typeof parteCompleto !== 'object') {
    throw new Error('Parte inválido para encolar.');
  }
  await db.pending_partes.add({
    payload: parteCompleto.payload,
    desplazamiento: parteCompleto.desplazamiento || null,
    intervension: parteCompleto.intervension || null,
    materialesSeleccionados: parteCompleto.materialesSeleccionados || [],
    materialesTextoInforme: parteCompleto.materialesTextoInforme || '',
    fotos: parteCompleto.fotos || [],
    firmaDataUrl: parteCompleto.firmaDataUrl || '',
    contexto: parteCompleto.contexto || {},
    createdAt: new Date().toISOString(),
    intentos: 0,
    ultimoError: null,
  });
  notificar();
  programarSync().catch(() => { /* noop */ });
}

export async function contarPartesPendientes() {
  try {
    return await db.pending_partes.count();
  } catch {
    return 0;
  }
}

export async function listarPartesPendientes() {
  try {
    return await db.pending_partes.orderBy('id').toArray();
  } catch {
    return [];
  }
}

let procesandoPartes = false;

async function ejecutarParteRemoto(item) {
  // Reproducir el flujo del enviarParte de ParteTrabajoView.
  // El informe PDF se genera más tarde, cuando el administrador valore
  // económicamente la orden, para evitar que existan PDFs "preliminares"
  // distintos del definitivo.
  await crearParteTrabajo({
    ...item.payload,
    materialesInventario: item.materialesSeleccionados,
    fotos_intervencion: item.fotos,
    desplazamiento: item.desplazamiento,
    intervension: item.intervension,
    firma_url: item.firmaDataUrl,
  });
}

export async function procesarColaPartes() {
  if (procesandoPartes || !estaOnline()) {
    return { procesados: 0, restantes: await contarPartesPendientes(), huboError: false };
  }
  procesandoPartes = true;
  let procesados = 0;
  let huboError = false;

  try {
    const pendientes = await listarPartesPendientes();
    for (const item of pendientes) {
      try {
        await ejecutarParteRemoto(item);
        await db.pending_partes.delete(item.id);
        procesados += 1;
      } catch (err) {
        // Marcamos error y reintentamos en el siguiente ciclo.
        await db.pending_partes.update(item.id, {
          intentos: (item.intentos || 0) + 1,
          ultimoError: String(err?.message || err),
        });
        // Si es error de red, paramos para no consumir intentos en cadena.
        if (esErrorRed(err)) {
          huboError = true;
          break;
        }
        // Si es error de validación (cliente borrado, stock, etc.), seguimos
        // con el siguiente para no bloquear toda la cola.
      }
    }
  } finally {
    procesandoPartes = false;
    notificar();
  }

  const restantes = await contarPartesPendientes();
  if (restantes > 0) {
    programarSync().catch(() => { /* noop */ });
  }
  return { procesados, restantes, huboError };
}

// =====================================================================
// Cola de puntos GPS (tracking/histórico)
// =====================================================================

export async function encolarPuntoGps(punto) {
  const ordenId = String(punto?.orden_id || punto?.ordenId || '').trim();
  if (!ordenId) {
    throw new Error('orden_id requerido para encolar punto GPS.');
  }
  const lat = Number(punto?.lat);
  const lng = Number(punto?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Coordenadas GPS inválidas.');
  }
  const recordedAt = punto?.recorded_at || punto?.recordedAt || new Date().toISOString();
  await db.pending_gps.add({
    ordenId,
    payload: {
      orden_id: ordenId,
      tecnico_id: punto?.tecnico_id || punto?.tecnicoId || null,
      lat,
      lng,
      accuracy_m: Number.isFinite(Number(punto?.accuracy_m)) ? Number(punto?.accuracy_m) : null,
      recorded_at: recordedAt,
      tipo: punto?.tipo || 'tracking',
      source: punto?.source || 'app',
    },
    createdAt: new Date().toISOString(),
    intentos: 0,
    ultimoError: null,
  });
  notificar();
  programarSync().catch(() => { /* noop */ });
}

export async function contarGpsPendientes() {
  try {
    return await db.pending_gps.count();
  } catch {
    return 0;
  }
}

async function listarGpsPendientes() {
  try {
    return await db.pending_gps.orderBy('id').toArray();
  } catch {
    return [];
  }
}

let procesandoGps = false;

export async function procesarColaGps() {
  if (procesandoGps || !estaOnline()) {
    return { procesados: 0, restantes: await contarGpsPendientes(), huboError: false };
  }
  procesandoGps = true;
  let procesados = 0;
  let huboError = false;

  try {
    const pendientes = await listarGpsPendientes();
    for (const item of pendientes) {
      try {
        await insertarPuntoGps(item.payload);
        await db.pending_gps.delete(item.id);
        procesados += 1;
      } catch (err) {
        await db.pending_gps.update(item.id, {
          intentos: (item.intentos || 0) + 1,
          ultimoError: String(err?.message || err),
        });
        const info = clasificarError(err);
        if (!info.retryable) {
          await registrarConflicto({
            ordenId: item.ordenId,
            tipo: 'gps',
            baseUpdatedAt: null,
            remoteUpdatedAt: null,
            clientUpdatedAt: item.createdAt,
            payload: item.payload,
            resolucion: 'discarded',
            motivo: err?.message || String(err),
          });
          await db.pending_gps.delete(item.id);
          procesados += 1;
          continue;
        }
        huboError = true;
        break;
      }
    }
  } finally {
    procesandoGps = false;
    notificar();
  }

  const restantes = await contarGpsPendientes();
  if (restantes > 0) {
    programarSync().catch(() => { /* noop */ });
  }
  return { procesados, restantes, huboError };
}

// ---------------------------------------------------------------------
// Listener global: al recuperar conexión, drenamos la cola.
// ---------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    procesarCola().catch(() => { /* noop */ });
    procesarColaPartes().catch(() => { /* noop */ });
    procesarColaGps().catch(() => { /* noop */ });
    notificar();
    programarSync({ force: true }).catch(() => { /* noop */ });
  });
  window.addEventListener('offline', () => {
    notificar();
  });
}

async function obtenerOrdenTrabajoActualizadaAt(ordenId) {
  try {
    const supabase = await import('./supabaseClient').then((m) => m.obtenerClienteSupabase());
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('id, updated_at')
      .eq('id', ordenId)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    programarSync({ force: true }).catch(() => { /* noop */ });
  }, 0);
}
