import { fetchJson, obtenerUrlFirmadaStorageApi } from './apiClient';

const runtimeConfig =
  typeof window !== 'undefined' && window.__APP_CONFIG__ ? window.__APP_CONFIG__ : null;
const apiBaseUrl = runtimeConfig?.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '/api';

export const supabase = null;

export function tieneConfiguracionSupabase() {
  return Boolean(apiBaseUrl);
}

export function obtenerClienteSupabase() {
  throw new Error('Supabase no está disponible en el hosting PHP/MySQL.');
}

export function parsearReferenciaStorage(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;

  if (texto.startsWith('sb://')) {
    const resto = texto.slice('sb://'.length);
    const separador = resto.indexOf('/');
    if (separador <= 0) return null;
    const bucket = resto.slice(0, separador);
    const path = resto.slice(separador + 1);
    if (!bucket || !path) return null;
    return { bucket, path };
  }

  try {
    const url = new URL(texto);
    const partes = url.pathname.split('/').filter(Boolean);
    const idxObject = partes.indexOf('object');
    if (idxObject === -1) return null;
    const tipo = partes[idxObject + 1];
    const bucket = partes[idxObject + 2];
    if (!bucket || (tipo !== 'public' && tipo !== 'sign')) return null;
    const path = partes.slice(idxObject + 3).join('/');
    if (!path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export async function obtenerUrlFirmadaStorage(referencia, opciones = {}) {
  const { expiresIn = 600 } = opciones;
  const ref = parsearReferenciaStorage(referencia);
  if (!ref) {
    return String(referencia || '').trim();
  }

  try {
    const url = await obtenerUrlFirmadaStorageApi(ref, { expiresIn });
    return url || String(referencia || '').trim();
  } catch {
    return String(referencia || '').trim();
  }
}
