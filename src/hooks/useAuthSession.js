import { useEffect, useState } from 'react';
import {
  cerrarSesion,
  escucharCambiosSesion,
  iniciarSesionConPassword,
  obtenerSesionActual,
} from '../services/authService';
import { tieneConfiguracionSupabase } from '../services/supabaseClient';

export function useAuthSession() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function evaluarSesion(siguienteSesion) {
    if (!tieneConfiguracionSupabase()) {
      setSesion(null);
      return { requiereMfa: false, sesion: null };
    }

    if (!siguienteSesion) {
      setSesion(null);
      return { requiereMfa: false, sesion: null };
    }

    setSesion(siguienteSesion);
    return { requiereMfa: false, sesion: siguienteSesion };
  }

  useEffect(() => {
    let montado = true;

    async function inicializarSesion() {
      if (!tieneConfiguracionSupabase()) {
        setCargando(false);
        return;
      }

      try {
        const sesionActual = await obtenerSesionActual();
        if (montado) {
          await evaluarSesion(sesionActual);
        }
      } catch (err) {
        if (montado) {
          setError(err.message || 'No se pudo comprobar la sesion actual.');
        }
      } finally {
        if (montado) {
          setCargando(false);
        }
      }
    }

    inicializarSesion();

    const desuscribir = escucharCambiosSesion((siguienteSesion) => {
      if (!montado) {
        return;
      }
      evaluarSesion(siguienteSesion).catch(() => {});
    });

    return () => {
      montado = false;
      desuscribir();
    };
  }, []);

  async function login(email, password) {
    setError('');
    const sesionCreada = await iniciarSesionConPassword({ email, password });
    const resultado = await evaluarSesion(sesionCreada);
    return resultado;
  }

  async function logout() {
    setError('');
    await cerrarSesion();
    setSesion(null);
  }

  return {
    sesion,
    mfaPendiente: false,
    cargando,
    error,
    login,
    verificarMfa: async () => null,
    cancelarMfa: async () => logout(),
    logout,
  };
}
