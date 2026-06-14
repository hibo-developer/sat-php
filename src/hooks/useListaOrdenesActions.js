import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function crearPrefillParteDesdeOrden(orden) {
  return {
    orden_id: orden.id,
    cliente_id: orden.clienteId || '',
    equipo_id: orden.equipoId || '',
    tecnico_id: orden.tecnicoId || '',
    descripcion_problema: orden.descripcion || '',
    prioridad: orden.prioridad || 'media',
    numero_ticket: orden.numero_ticket || '',
  };
}

export function useListaOrdenesActions() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  function notificar(siguienteToast) {
    setToast({
      id: Date.now(),
      ...siguienteToast,
    });
  }

  function cerrarToast() {
    setToast(null);
  }

  function irAParteDesdeOrden(orden) {
    navigate('/parte', {
      state: {
        prefill: crearPrefillParteDesdeOrden(orden),
      },
    });
  }

  return {
    toast,
    notificar,
    cerrarToast,
    irAParteDesdeOrden,
  };
}
