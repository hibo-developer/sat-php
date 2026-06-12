import { fetchJson } from './apiClient';

export async function listarTecnicos() {
  const data = await fetchJson('/tecnicos');
  return Array.isArray(data) ? data : [];
}

export async function crearTecnico(payload) {
  return fetchJson('/tecnicos', { method: 'POST', body: payload });
}

export async function actualizarTecnico(idTecnico, payload) {
  return fetchJson(`/tecnicos/${idTecnico}`, { method: 'PUT', body: payload });
}

export async function eliminarTecnico(idTecnico) {
  await fetchJson(`/tecnicos/${idTecnico}`, { method: 'DELETE', body: {} });
}
