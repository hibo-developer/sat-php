import { PASOS_PARTE } from '../services/parteTrabajoViewUtils';

export function useParteTrabajoSteps({
  desplazamiento,
  firmaClienteDataUrl,
  formulario,
  intervension,
  pasoActual,
  setError,
  setPasoActual,
}) {
  function fallarPaso(indicePaso, mensajePaso) {
    setPasoActual(indicePaso);
    setError(mensajePaso);
    return false;
  }

  function validarPaso(indicePaso, opciones = {}) {
    const { mostrarError = true } = opciones;
    const fallar = (mensajePaso) => {
      if (mostrarError) {
        return fallarPaso(indicePaso, mensajePaso);
      }
      return false;
    };

    if (indicePaso === 0) {
      if (!formulario.tecnico_id) {
        return fallar('Debes seleccionar un técnico antes de continuar.');
      }
      if (!formulario.cliente_id && !(formulario.cliente_nombre || '').trim()) {
        return fallar('Selecciona un cliente o escribe su nombre para continuar.');
      }
      if ((formulario.descripcion_problema || '').trim().length < 8) {
        return fallar('La descripción del problema debe tener al menos 8 caracteres.');
      }
      return true;
    }

    if (indicePaso === 1) {
      if (!desplazamiento.inicioIso || !desplazamiento.finIso) {
        return fallar('Completa el desplazamiento antes de continuar.');
      }
      if (!intervension.inicioIso || !intervension.finIso) {
        return fallar('Completa la intervención antes de continuar.');
      }
      if (intervension.pausaComidaActiva?.inicioIso) {
        return fallar('Finaliza la pausa de comida activa antes de continuar.');
      }
      return true;
    }

    if (indicePaso === 2) {
      const minutos = Number.parseInt(formulario.tiempo_empleado, 10);
      if (!Number.isFinite(minutos) || minutos <= 0) {
        return fallar('Indica un tiempo empleado válido antes de continuar.');
      }
      return true;
    }

    if (indicePaso === 3) {
      if (!(formulario.nombre_firmante || '').trim()) {
        return fallar('Debes indicar el nombre de la persona que firma el parte.');
      }
      if (!firmaClienteDataUrl) {
        return fallar('La firma del cliente es obligatoria para completar el parte.');
      }
      return true;
    }

    return true;
  }

  function irAPaso(indiceDestino) {
    if (indiceDestino < 0 || indiceDestino >= PASOS_PARTE.length) {
      return;
    }
    if (indiceDestino <= pasoActual) {
      setPasoActual(indiceDestino);
      return;
    }
    for (let i = 0; i < indiceDestino; i += 1) {
      if (!validarPaso(i, { mostrarError: true })) {
        return;
      }
    }
    setError('');
    setPasoActual(indiceDestino);
  }

  function avanzarPaso() {
    if (!validarPaso(pasoActual, { mostrarError: true })) {
      return;
    }
    setError('');
    setPasoActual((prev) => Math.min(PASOS_PARTE.length - 1, prev + 1));
  }

  function retrocederPaso() {
    setError('');
    setPasoActual((prev) => Math.max(0, prev - 1));
  }

  const estadosPasos = PASOS_PARTE.map((paso, indice) => ({
    ...paso,
    activo: indice === pasoActual,
    completado: validarPaso(indice, { mostrarError: false }),
  }));

  return {
    avanzarPaso,
    estadosPasos,
    fallarPaso,
    irAPaso,
    retrocederPaso,
    validarPaso,
  };
}
