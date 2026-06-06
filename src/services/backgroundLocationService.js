import { Capacitor, registerPlugin } from '@capacitor/core';
import { encolarPuntoGps } from './offlineSyncService';

const BackgroundLocation = registerPlugin('BackgroundLocation');

function getPlugin() {
  if (!Capacitor.isNativePlatform()) return null;
  return BackgroundLocation || null;
}

export async function iniciarTrackingBackground({ ordenId, tecnicoId, intervalMinutes = 5 }) {
  const plugin = getPlugin();
  if (!plugin) return { disponible: false };
  await plugin.start({ ordenId, tecnicoId, intervalMinutes });
  return { disponible: true };
}

export async function detenerTrackingBackground() {
  const plugin = getPlugin();
  if (!plugin) return { disponible: false };
  await plugin.stop();
  return { disponible: true };
}

export async function obtenerEstadoTrackingBackground() {
  const plugin = getPlugin();
  if (!plugin) return { disponible: false, running: false };
  const estado = await plugin.getStatus();
  return {
    disponible: true,
    running: Boolean(estado?.running),
    ordenId: estado?.ordenId || '',
    tecnicoId: estado?.tecnicoId || '',
    intervalMs: Number(estado?.intervalMs || 0),
  };
}

export async function obtenerTrackingBackgroundPendiente() {
  const plugin = getPlugin();
  if (!plugin) return { disponible: false, items: [] };
  const rsp = await plugin.getPending();
  const items = Array.isArray(rsp?.items) ? rsp.items : [];
  return { disponible: true, items };
}

export async function volcarTrackingBackgroundPendiente() {
  const plugin = getPlugin();
  if (!plugin) return { disponible: false, procesados: 0 };
  const rsp = await plugin.getPending();
  const items = Array.isArray(rsp?.items) ? rsp.items : [];
  for (const item of items) {
    try {
      await encolarPuntoGps(item);
    } catch { /* noop */ }
  }
  if (items.length > 0) {
    await plugin.clearPending();
  }
  return { disponible: true, procesados: items.length };
}
