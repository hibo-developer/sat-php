import { fetchJson } from './apiClient';

export async function listarEquipos() {
  const data = await fetchJson('/equipos');
  return Array.isArray(data) ? data : [];
}

export async function crearEquipo(payload) {
  return fetchJson('/equipos', { method: 'POST', body: payload });
}

export async function actualizarEquipo(idEquipo, payload) {
  return fetchJson(`/equipos/${idEquipo}`, { method: 'PUT', body: payload });
}

export async function eliminarEquipo(idEquipo) {
  await fetchJson(`/equipos/${idEquipo}`, { method: 'DELETE', body: {} });
}
