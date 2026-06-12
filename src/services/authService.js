import { fetchJson, setCsrfToken } from './apiClient';
import { tieneBackendApi } from './backendClient';

export async function obtenerSesionActual() {
  if (!tieneBackendApi()) {
    return null;
  }
  const data = await fetchJson('/auth/me');
  if (data?.csrfToken) {
    setCsrfToken(data.csrfToken);
  }
  return data?.session || null;
}

export async function iniciarSesionConPassword({ email, password }) {
  const data = await fetchJson('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (data?.csrfToken) {
    setCsrfToken(data.csrfToken);
  }
  return data?.session || null;
}

export async function cerrarSesion() {
  await fetchJson('/auth/logout', { method: 'POST', body: {} });
  setCsrfToken('');
}

export async function actualizarPasswordUsuarioActual(nuevaPassword) {
  await fetchJson('/auth/password', { method: 'POST', body: { password: nuevaPassword } });
}

export function escucharCambiosSesion(onCambio) {
  return () => {};
}
