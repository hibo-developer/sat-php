import { fetchJson } from './apiClient';

export async function listarClientes() {
  const data = await fetchJson('/clientes');
  return Array.isArray(data) ? data : [];
}

export async function crearCliente(payload) {
  return fetchJson('/clientes', { method: 'POST', body: payload });
}

export async function actualizarCliente(idCliente, payload) {
  return fetchJson(`/clientes/${idCliente}`, { method: 'PUT', body: payload });
}

export async function eliminarCliente(idCliente) {
  await fetchJson(`/clientes/${idCliente}`, { method: 'DELETE', body: {} });
}
