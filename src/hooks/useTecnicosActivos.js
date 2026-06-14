import { useEffect, useState } from 'react';
import { obtenerTecnicosActivos } from '../services/catalogosService';
import { tieneBackendApi } from '../services/backendClient';

export function useTecnicosActivos() {
  const [tecnicosActivos, setTecnicosActivos] = useState([]);

  useEffect(() => {
    async function cargarTecnicosEdicion() {
      if (!tieneBackendApi()) {
        setTecnicosActivos([]);
        return;
      }

      try {
        const respuesta = await obtenerTecnicosActivos({ limite: 100, pagina: 1 });
        setTecnicosActivos(respuesta.items);
      } catch {
        setTecnicosActivos([]);
      }
    }

    cargarTecnicosEdicion();
  }, []);

  return tecnicosActivos;
}
