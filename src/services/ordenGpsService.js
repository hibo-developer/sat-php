import { fetchJson } from './apiClient';

export async function insertarPuntoGps(payload) {
  return fetchJson('/gps', { method: 'POST', body: payload });
}

