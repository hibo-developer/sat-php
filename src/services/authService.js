import { obtenerClienteSupabase, tieneConfiguracionSupabase } from './supabaseClient';

export async function obtenerSesionActual() {
  if (!tieneConfiguracionSupabase()) {
    return null;
  }

  const supabase = obtenerClienteSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`No se pudo recuperar la sesion actual: ${error.message}`);
  }

  return data.session;
}

export async function iniciarSesionConPassword({ email, password }) {
  const supabase = obtenerClienteSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`No se pudo iniciar sesion: ${error.message}`);
  }

  return data.session;
}

export async function obtenerNivelAseguramientoSesion() {
  const supabase = obtenerClienteSupabase();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    throw new Error(`No se pudo comprobar el nivel de seguridad de la sesion: ${error.message}`);
  }
  return data;
}

export async function listarFactoresMfa() {
  const supabase = obtenerClienteSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw new Error(`No se pudieron cargar los factores MFA: ${error.message}`);
  }
  return data;
}

export async function enrolarTotpMfa() {
  const supabase = obtenerClienteSupabase();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) {
    throw new Error(`No se pudo iniciar el alta de 2FA: ${error.message}`);
  }
  return data;
}

export async function verificarTotpMfa({ factorId, code }) {
  const supabase = obtenerClienteSupabase();
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) {
    throw new Error(`No se pudo iniciar la verificacion 2FA: ${challenge.error.message}`);
  }
  const challengeId = challenge.data?.id;
  const verify = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  if (verify.error) {
    throw new Error(`Codigo 2FA no valido: ${verify.error.message}`);
  }
  return verify.data;
}

export async function desenrolarMfa({ factorId }) {
  const supabase = obtenerClienteSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new Error(`No se pudo desactivar 2FA: ${error.message}`);
  }
}

export async function cerrarSesion() {
  const supabase = obtenerClienteSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`No se pudo cerrar sesion: ${error.message}`);
  }
}

export async function actualizarPasswordUsuarioActual(nuevaPassword) {
  const supabase = obtenerClienteSupabase();
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });

  if (error) {
    throw new Error(`No se pudo actualizar la contrasena: ${error.message}`);
  }
}

export function escucharCambiosSesion(onCambio) {
  if (!tieneConfiguracionSupabase()) {
    return () => {};
  }

  const supabase = obtenerClienteSupabase();
  const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
    onCambio(sesion || null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
