import { useEffect, useState } from 'react';
import { obtenerUrlFirmadaStorage } from '../services/backendClient';
import { resolverNombreDescargaInforme } from '../services/informeNombre';
import {
  datetimeLocalAIso,
  detectarFueraHorario,
  esFinDeSemana,
  isoADatetimeLocal,
  obtenerFechaRegeneracionDesdeUrl,
} from '../services/ordenesViewUtils';

function crearFormularioEdicion(orden) {
  return {
    tecnico_id: orden.tecnicoId || '',
    prioridad: orden.prioridad || 'media',
    estado: orden.estado === 'En Proceso' ? 'en_proceso' : orden.estado === 'Pausado' ? 'pausado' : 'pendiente',
  };
}

function crearFormularioValoracion(orden) {
  const aplicaRecargoFestivoPorDefecto = typeof orden.aplicaRecargoFestivo === 'boolean'
    ? orden.aplicaRecargoFestivo
    : esFinDeSemana(orden.fechaInicioIso);
  const aplicaRecargoFueraHorarioPorDefecto = typeof orden.aplicaRecargoFueraHorario === 'boolean'
    ? orden.aplicaRecargoFueraHorario
    : detectarFueraHorario(orden.fechaInicioIso, orden.fechaFinIso);

  return {
    coste_materiales_editable: Number(orden.costeMaterialesEditable || orden.costeMateriales || 0).toFixed(2),
    tarifa_mano_obra_hora: Number(orden.tarifaManoObraHora || 0).toFixed(2),
    horas_mano_obra: Number(orden.horasManoObra || 0).toFixed(2),
    mecanicos_intervinieron: String(orden.mecanicosIntervinieron ?? 1),
    fecha_inicio: isoADatetimeLocal(orden.fechaInicioIso),
    fecha_fin: isoADatetimeLocal(orden.fechaFinIso),
    tarifa_desplazamiento_km: Number(orden.tarifaDesplazamientoKm || 0).toFixed(2),
    km_desplazamiento_facturables: Number(orden.kmDesplazamientoFacturables || 0).toFixed(2),
    recargo_festivo_pct: Number(orden.recargoFestivoPct ?? 25).toFixed(2),
    recargo_fuera_horario_pct: Number(orden.recargoFueraHorarioPct ?? 20).toFixed(2),
    aplica_recargo_festivo: aplicaRecargoFestivoPorDefecto,
    aplica_recargo_fuera_horario: aplicaRecargoFueraHorarioPorDefecto,
  };
}

export function useTarjetaOrden({
  orden,
  onActualizar,
  onValorarFinalizada,
  onEliminar,
  onNotificar,
}) {
  const [mostrarEdicion, setMostrarEdicion] = useState(false);
  const [mostrarValoracion, setMostrarValoracion] = useState(false);
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [copiaGuardada, setCopiaGuardada] = useState(false);
  const [mensajeEdicion, setMensajeEdicion] = useState('');
  const [mensajeValoracion, setMensajeValoracion] = useState('');
  const [mensajeEliminacion, setMensajeEliminacion] = useState('');
  const [descargandoInforme, setDescargandoInforme] = useState(false);
  const [formularioEdicion, setFormularioEdicion] = useState(() => crearFormularioEdicion(orden));
  const [formularioValoracion, setFormularioValoracion] = useState(() => crearFormularioValoracion(orden));

  useEffect(() => {
    setFormularioEdicion(crearFormularioEdicion(orden));
  }, [orden.estado, orden.prioridad, orden.tecnicoId]);

  useEffect(() => {
    setFormularioValoracion(crearFormularioValoracion(orden));
  }, [
    orden.costeMateriales,
    orden.costeMaterialesEditable,
    orden.tarifaManoObraHora,
    orden.horasManoObra,
    orden.tarifaDesplazamientoKm,
    orden.kmDesplazamientoFacturables,
    orden.recargoFestivoPct,
    orden.recargoFueraHorarioPct,
    orden.aplicaRecargoFestivo,
    orden.aplicaRecargoFueraHorario,
    orden.fechaInicioIso,
    orden.fechaFinIso,
    orden.mecanicosIntervinieron,
  ]);

  async function guardarEdicion(evento) {
    evento.preventDefault();
    setMensajeEdicion('');

    try {
      await onActualizar(orden.id, formularioEdicion);
      setMostrarEdicion(false);
      setMensajeEdicion('Orden actualizada correctamente.');
      onNotificar({
        tipo: 'exito',
        titulo: 'Orden actualizada',
        descripcion: 'Se han guardado el técnico, el estado y la prioridad.',
      });
    } catch (err) {
      setMensajeEdicion(err.message || 'No se pudo actualizar la orden.');
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo actualizar la orden',
        descripcion: err.message || 'Revisa los cambios y vuelve a intentarlo.',
      });
    }
  }

  async function guardarValoracion(evento) {
    evento.preventDefault();
    setMensajeValoracion('');

    try {
      const inicio = String(formularioValoracion.fecha_inicio || '').trim();
      const fin = String(formularioValoracion.fecha_fin || '').trim();
      if ((inicio && !fin) || (!inicio && fin)) {
        setMensajeValoracion('Debes indicar inicio y fin de intervención.');
        return;
      }
      const payload = { ...formularioValoracion };
      if (inicio && fin) {
        const iniIso = datetimeLocalAIso(inicio);
        const finIso = datetimeLocalAIso(fin);
        if (!iniIso || !finIso) {
          setMensajeValoracion('El formato de fecha/hora de intervención no es válido.');
          return;
        }
        payload.fecha_inicio = iniIso;
        payload.fecha_fin = finIso;
      }
      await onValorarFinalizada(orden.id, payload);
      setMostrarValoracion(false);
      setMensajeValoracion('Valoración guardada e informe regenerado correctamente.');
      onNotificar({
        tipo: 'exito',
        titulo: 'Valoración actualizada',
        descripcion: 'Se actualizaron importes y se regeneró el informe PDF de la orden.',
      });
    } catch (err) {
      setMensajeValoracion(err.message || 'No se pudo guardar la valoración.');
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo actualizar la valoración',
        descripcion: err.message || 'Revisa los importes y vuelve a intentarlo.',
      });
    }
  }

  function descargarCopiaJsonOrden() {
    const payload = {
      generadoEn: new Date().toISOString(),
      orden,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `copia-orden-${orden.numero_ticket || orden.id}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }

  async function descargarInformePdf() {
    if (!orden.informePdfUrl || descargandoInforme) {
      return;
    }
    setDescargandoInforme(true);
    try {
      const url = await obtenerUrlFirmadaStorage(orden.informePdfUrl, { expiresIn: 900 });
      if (!url) {
        throw new Error('No se pudo obtener el enlace del informe.');
      }
      const respuesta = await fetch(url, { credentials: 'include' });
      if (!respuesta.ok) {
        throw new Error('No se pudo descargar el informe.');
      }
      const blob = await respuesta.blob();
      const blobUrl = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = blobUrl;
      enlace.download = resolverNombreDescargaInforme(orden);
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      onNotificar?.({
        tipo: 'error',
        titulo: 'No se pudo descargar el informe',
        descripcion: err?.message || 'Inténtalo de nuevo en unos segundos.',
      });
    } finally {
      setDescargandoInforme(false);
    }
  }

  async function confirmarEliminacion() {
    setMensajeEliminacion('');
    try {
      await onEliminar(orden.id);
      setMostrarEliminar(false);
      setCopiaGuardada(false);
      onNotificar({
        tipo: 'exito',
        titulo: 'Orden eliminada',
        descripcion: `La orden ${orden.numero_ticket ? `SAT-${orden.numero_ticket}` : orden.id} fue eliminada correctamente.`,
      });
    } catch (err) {
      setMensajeEliminacion(err.message || 'No se pudo eliminar la orden.');
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo eliminar la orden',
        descripcion: err.message || 'Inténtalo de nuevo en unos segundos.',
      });
    }
  }

  function alternarEliminar() {
    setMostrarEliminar((previo) => !previo);
    setMensajeEliminacion('');
    setCopiaGuardada(false);
  }

  function actualizarFormularioEdicion(cambios) {
    setFormularioEdicion((previo) => ({ ...previo, ...cambios }));
  }

  function actualizarFormularioValoracion(cambios) {
    setFormularioValoracion((previo) => ({ ...previo, ...cambios }));
  }

  function toggleMostrarValoracion() {
    setMostrarValoracion((previo) => !previo);
    setMensajeValoracion('');
  }

  function toggleMostrarEdicion() {
    setMostrarEdicion((previo) => !previo);
    setMensajeEdicion('');
  }

  const costeManoObraBasePreview = Number(formularioValoracion.tarifa_mano_obra_hora || 0)
    * Number(formularioValoracion.horas_mano_obra || 0)
    * Math.max(1, Number.parseInt(formularioValoracion.mecanicos_intervinieron || '1', 10) || 1);
  const porcentajeRecargoManoObraPreview = (formularioValoracion.aplica_recargo_festivo
    ? Number(formularioValoracion.recargo_festivo_pct || 0)
    : 0)
    + (formularioValoracion.aplica_recargo_fuera_horario
      ? Number(formularioValoracion.recargo_fuera_horario_pct || 0)
      : 0);
  const recargoManoObraEurosPreview = costeManoObraBasePreview * (porcentajeRecargoManoObraPreview / 100);
  const costeManoObraPreview = costeManoObraBasePreview + recargoManoObraEurosPreview;
  const costeDesplazamientoPreview = Number(formularioValoracion.tarifa_desplazamiento_km || 0)
    * Number(formularioValoracion.km_desplazamiento_facturables || 0);
  const costeTotalPreview = Number(formularioValoracion.coste_materiales_editable || 0)
    + costeManoObraPreview
    + costeDesplazamientoPreview;

  return {
    fechaRegeneracionInforme: obtenerFechaRegeneracionDesdeUrl(orden.informePdfUrl),
    mostrarEdicion,
    mostrarValoracion,
    mostrarEliminar,
    copiaGuardada,
    setCopiaGuardada,
    mensajeEdicion,
    mensajeValoracion,
    mensajeEliminacion,
    descargandoInforme,
    formularioEdicion,
    formularioValoracion,
    guardarEdicion,
    guardarValoracion,
    descargarCopiaJsonOrden,
    descargarInformePdf,
    confirmarEliminacion,
    alternarEliminar,
    actualizarFormularioEdicion,
    actualizarFormularioValoracion,
    toggleMostrarValoracion,
    toggleMostrarEdicion,
    costeManoObraBasePreview,
    porcentajeRecargoManoObraPreview,
    recargoManoObraEurosPreview,
    costeManoObraPreview,
    costeDesplazamientoPreview,
    costeTotalPreview,
  };
}
