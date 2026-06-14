import { crearParteTrabajo } from '../services/parteTrabajoService';
import { encolarParteFinalizado, estaOnline } from '../services/offlineSyncService';
import {
  DESPLAZAMIENTO_INICIAL,
  FORM_INICIAL,
  INTERVENSION_INICIAL,
  limpiarBorradorParte,
  PASOS_PARTE,
  SEGUIMIENTO_INICIAL,
} from '../services/parteTrabajoViewUtils';

export function useParteTrabajoSubmit({
  clientes,
  desplazamiento,
  equipos,
  fallarPaso,
  firmaClienteDataUrl,
  formulario,
  fotosIntervencion,
  ignorarGuardadoBorradorRef,
  intervension,
  limpiarFirma,
  materialesInventario,
  materialesSeleccionados,
  pasoActual,
  setDesplazamiento,
  setEquipos,
  setError,
  setFormulario,
  setFotosIntervencion,
  setGuardando,
  setIntervension,
  setMaterialSeleccionadoCantidad,
  setMaterialSeleccionadoId,
  setMaterialesSeleccionados,
  setMensaje,
  setOrdenesAbiertas,
  setPasoActual,
  setPendienteGeoIntervension,
  setSeguimientoTiempo,
  tecnicos,
  validarPaso,
  avanzarPaso,
}) {
  function resetearFormulario() {
    ignorarGuardadoBorradorRef.current = true;
    setPasoActual(0);
    setFormulario(FORM_INICIAL);
    setDesplazamiento(DESPLAZAMIENTO_INICIAL);
    setIntervension(INTERVENSION_INICIAL);
    setPendienteGeoIntervension(false);
    setSeguimientoTiempo(SEGUIMIENTO_INICIAL);
    limpiarFirma();
    setEquipos([]);
    setOrdenesAbiertas([]);
    setMaterialesSeleccionados([]);
    setMaterialSeleccionadoId('');
    setMaterialSeleccionadoCantidad('1');
    setFotosIntervencion([]);
    limpiarBorradorParte();
  }

  function eliminarParteBorrador() {
    if (!window.confirm('¿Eliminar este parte sin guardar? Se perderán los datos registrados.')) {
      return;
    }
    setMensaje('');
    setError('');
    resetearFormulario();
    setMensaje('Parte eliminado.');
  }

  async function enviarParte(evento) {
    evento.preventDefault();
    if (pasoActual < PASOS_PARTE.length - 1) {
      avanzarPaso();
      return;
    }

    setMensaje('');
    setError('');

    if (!validarPaso(0, { mostrarError: true })) {
      return;
    }

    if (!desplazamiento.inicioIso || !desplazamiento.finIso) {
      fallarPaso(1, 'Debes completar el desplazamiento (Inicio y Fin) antes de guardar el parte.');
      return;
    }

    if (!intervension.inicioIso || !intervension.finIso) {
      fallarPaso(1, 'Debes completar la intervención (Inicio y Fin) antes de guardar el parte.');
      return;
    }

    if (intervension.pausaComidaActiva?.inicioIso) {
      fallarPaso(1, 'Debes finalizar la pausa de comida activa antes de guardar el parte.');
      return;
    }

    if (!firmaClienteDataUrl) {
      fallarPaso(3, 'La firma del cliente es obligatoria para registrar el parte.');
      return;
    }

    if (!(formulario.nombre_firmante || '').trim()) {
      fallarPaso(3, 'Debes indicar el nombre de la persona que firma el parte.');
      return;
    }

    if (!formulario.orden_id && !formulario.cliente_id && !(formulario.cliente_nombre || '').trim()) {
      fallarPaso(0, 'En partes sin orden, selecciona un cliente o escribe su nombre para crearlo/usarlo.');
      return;
    }

    setGuardando(true);

    const clienteSeleccionado = clientes.find((c) => c.id === formulario.cliente_id);
    const equipoSeleccionado = equipos.find((e) => e.id === formulario.equipo_id);
    const tecnicoSeleccionado = tecnicos.find((t) => t.id === formulario.tecnico_id);
    const clienteNombreInforme = clienteSeleccionado?.nombre || (formulario.cliente_nombre || '').trim() || 'Cliente no identificado';
    const equipoNombreInforme = equipoSeleccionado?.nombre || (formulario.equipo_nombre || '').trim() || 'Sin equipo';
    const materialesInventarioTexto = materialesSeleccionados
      .map((uso) => {
        const material = materialesInventario.find((m) => m.id === uso.material_id);
        if (!material) {
          return null;
        }
        const precio = material.precio_ref ?? 'N/D';
        return `${material.nombre};${uso.cantidad};${precio}`;
      })
      .filter(Boolean)
      .join('\n');

    const materialesTextoInforme = [materialesInventarioTexto, formulario.materialesTexto]
      .filter((bloque) => (bloque || '').trim())
      .join('\n');

    const payloadParte = {
      ...formulario,
      orden_id: formulario.orden_id,
      cliente_nombre: formulario.cliente_nombre,
      equipo_id: formulario.equipo_id || null,
      equipo_nombre: formulario.equipo_nombre,
      tecnico_id: formulario.tecnico_id || null,
    };

    async function encolarOffline(motivo) {
      await encolarParteFinalizado({
        payload: payloadParte,
        desplazamiento,
        intervension,
        materialesSeleccionados,
        materialesTextoInforme,
        fotos: fotosIntervencion,
        firmaDataUrl: firmaClienteDataUrl,
        contexto: {
          clienteNombre: clienteNombreInforme,
          equipoNombre: equipoNombreInforme,
          tecnicoNombre: tecnicoSeleccionado?.nombre || 'Tecnico no identificado',
        },
      });
      setMensaje(`Parte guardado localmente${motivo ? ` (${motivo})` : ''}. Se enviará automáticamente al recuperar conexión.`);
      resetearFormulario();
    }

    if (!estaOnline()) {
      try {
        await encolarOffline('sin conexión');
      } catch (err) {
        setError(err.message || 'No se pudo guardar el parte localmente.');
      } finally {
        setGuardando(false);
      }
      return;
    }

    try {
      await crearParteTrabajo({
        ...payloadParte,
        materialesInventario: materialesSeleccionados,
        fotos_intervencion: fotosIntervencion,
        desplazamiento,
        intervension,
        firma_url: firmaClienteDataUrl,
      });

      setMensaje('Parte registrado. El informe PDF estará disponible cuando el administrador valore la orden.');
      resetearFormulario();
    } catch (err) {
      const mensaje = String(err?.message || err).toLowerCase();
      const esRed = mensaje.includes('failed to fetch')
        || mensaje.includes('networkerror')
        || mensaje.includes('network error')
        || mensaje.includes('load failed')
        || mensaje.includes('fetch failed')
        || mensaje.includes('timeout')
        || mensaje.includes('offline');
      if (esRed) {
        try {
          await encolarOffline('conexión perdida durante el envío');
        } catch (errEncolar) {
          setError(errEncolar.message || 'No se pudo guardar el parte localmente.');
        }
      } else {
        setError(err.message || 'No se pudo registrar el parte de trabajo.');
      }
    } finally {
      setGuardando(false);
    }
  }

  return {
    eliminarParteBorrador,
    enviarParte,
    resetearFormulario,
  };
}
