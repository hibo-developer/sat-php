import { fetchJson } from './apiClient';
import {
  limpiarTexto,
  validarMinutos,
  validarPrioridad,
  validarTextoRequerido,
  validarUrlOpcional,
} from './satValidation';
import { generarYSubirInformeParte } from './parteTrabajoInformeService';

const ESTADOS_EDITABLES = new Set(['pendiente', 'en_proceso', 'pausado']);

function validarEstadoEditable(estado) {
  const estadoLimpio = limpiarTexto(estado).toLowerCase();
  if (!ESTADOS_EDITABLES.has(estadoLimpio)) {
    throw new Error('El estado seleccionado no es válido para una orden abierta.');
  }
  return estadoLimpio;
}

export function mapearValoracionEconomicaParaInforme(orden) {
  return {
    costeMaterialesEditable: orden?.coste_materiales_editable ?? null,
    tarifaManoObraHora: orden?.tarifa_mano_obra_hora ?? null,
    horasManoObra: orden?.horas_mano_obra ?? null,
    mecanicosIntervinieron: orden?.mecanicos_intervinieron ?? null,
    tarifaDesplazamientoKm: orden?.tarifa_desplazamiento_km ?? null,
    kmDesplazamientoFacturables: orden?.km_desplazamiento_facturables ?? null,
    recargoFestivoPct: orden?.recargo_festivo_pct ?? null,
    recargoFueraHorarioPct: orden?.recargo_fuera_horario_pct ?? null,
    aplicaRecargoFestivo: orden?.aplica_recargo_festivo ?? null,
    aplicaRecargoFueraHorario: orden?.aplica_recargo_fuera_horario ?? null,
    costeManoObraTotal: orden?.coste_mano_obra_total ?? null,
    costeDesplazamientoTotal: orden?.coste_desplazamiento_total ?? null,
    costeTotal: orden?.coste_total ?? null,
  };
}

export async function obtenerOrdenesTrabajo() {
  const data = await fetchJson('/ordenes');
  return Array.isArray(data) ? data : [];
}

export async function crearOrdenTrabajo(ordenNueva) {
  const clienteId = limpiarTexto(ordenNueva.cliente_id);
  if (!clienteId) {
    throw new Error('Debes seleccionar un cliente para crear la orden.');
  }

  const descripcionAveria = validarTextoRequerido(ordenNueva.descripcion_averia, 'La descripción de la avería', 8);
  const prioridad = validarPrioridad(ordenNueva.prioridad ?? 'media');
  const equipoId = limpiarTexto(ordenNueva.equipo_id) || null;
  const tecnicoId = limpiarTexto(ordenNueva.tecnico_id);

  if (!tecnicoId) {
    throw new Error('Debes asignar un técnico antes de crear la orden.');
  }

  const payload = {
    cliente_id: clienteId,
    equipo_id: equipoId,
    tecnico_id: tecnicoId,
    descripcion_averia: descripcionAveria,
    tareas_realizadas: ordenNueva.tareas_realizadas ?? null,
    tiempo_empleado_minutos: ordenNueva.tiempo_empleado_minutos ?? null,
    estado: ordenNueva.estado ?? 'pendiente',
    prioridad,
    foto_url: validarUrlOpcional(ordenNueva.foto_url, 'La URL de la foto') ?? null,
    firma_url: ordenNueva.firma_url ?? null,
    fecha_inicio: ordenNueva.fecha_inicio ?? new Date().toISOString(),
    fecha_fin: ordenNueva.fecha_fin ?? null,
  };

  return fetchJson('/ordenes', { method: 'POST', body: payload });
}

export async function finalizarOrdenTrabajo(idOrden, { tareasRealizadas, fotoUrl, tiempoEmpleadoMinutos }) {
  const ordenId = limpiarTexto(idOrden);
  if (!ordenId) {
    throw new Error('La orden que intentas finalizar no es válida.');
  }

  const tareas = validarTextoRequerido(tareasRealizadas, 'Las tareas realizadas', 8);
  const minutos = validarMinutos(tiempoEmpleadoMinutos, 'El tiempo de cierre');
  const foto = validarUrlOpcional(fotoUrl, 'La URL de la foto');

  return fetchJson(`/ordenes/${ordenId}/finalizar`, {
    method: 'POST',
    body: {
      tareasRealizadas: tareas,
      tiempoEmpleadoMinutos: minutos,
      fotoUrl: foto,
    },
  });
}

export async function actualizarOrdenTrabajo(idOrden, cambios, opciones = {}) {
  const ordenId = limpiarTexto(idOrden);
  const tecnicoId = limpiarTexto(cambios.tecnico_id);
  const expectedUpdatedAt = limpiarTexto(opciones.expectedUpdatedAt) || '';

  if (!ordenId) {
    throw new Error('La orden que intentas actualizar no es válida.');
  }
  if (!tecnicoId) {
    throw new Error('Debes asignar un técnico válido a la orden.');
  }

  const prioridad = validarPrioridad(cambios.prioridad ?? 'media');
  const estado = validarEstadoEditable(cambios.estado ?? 'pendiente');

  const qp = new URLSearchParams();
  if (expectedUpdatedAt) qp.set('expectedUpdatedAt', expectedUpdatedAt);

  return fetchJson(`/ordenes/${ordenId}?${qp.toString()}`, {
    method: 'PUT',
    body: { tecnico_id: tecnicoId, prioridad, estado },
  });
}

export async function eliminarOrdenTrabajo(ordenId) {
  const id = limpiarTexto(ordenId);
  if (!id) {
    throw new Error('La orden que intentas eliminar no es válida.');
  }
  await fetchJson(`/ordenes/${id}`, { method: 'DELETE', body: {} });
}

export async function guardarInformePdfUrl(ordenId, pdfUrl) {
  const id = limpiarTexto(ordenId);
  const payload = typeof pdfUrl === 'object' && pdfUrl !== null ? pdfUrl : { pdfUrl };
  const url = limpiarTexto(payload.pdfUrl);
  const referenciaInforme = limpiarTexto(payload.referenciaInforme);
  if (!id) {
    throw new Error('ID de orden requerido para guardar el informe PDF.');
  }
  if (!url) {
    throw new Error('URL PDF requerida.');
  }
  await fetchJson(`/ordenes/${id}/informe`, { method: 'POST', body: { pdfUrl: url, referenciaInforme } });
}

export async function reservarReferenciaInforme(ordenId) {
  const id = limpiarTexto(ordenId);
  if (!id) {
    throw new Error('ID de orden requerido para reservar la referencia del informe.');
  }

  const data = await fetchJson(`/ordenes/${id}/informe-referencia`, { method: 'POST', body: {} });
  return {
    referenciaInforme: limpiarTexto(data?.reference),
    nombreArchivo: limpiarTexto(data?.filename),
    secuencialDiario: Number(data?.sequence) || 1,
    fechaInforme: limpiarTexto(data?.date),
    timezone: limpiarTexto(data?.timezone),
  };
}

export async function actualizarValoracionOrdenFinalizada(ordenId, payload) {
  const id = limpiarTexto(ordenId);
  if (!id) {
    throw new Error('La orden a valorar no es válida.');
  }
  const orden = await fetchJson(`/ordenes/${id}/valoracion`, { method: 'POST', body: payload || {} });

  const tareas = String(orden?.tareas_realizadas || '');
  const nombreFirmante = (() => {
    const m = /Firmado por:\s*([^|]+)/i.exec(tareas);
    return (m && m[1] ? m[1].trim() : '') || '';
  })();
  const fotos = (() => {
    const m = /Fotos intervención:\s*(.+)$/i.exec(tareas);
    if (!m || !m[1]) return [];
    return m[1].split('|').map((u) => u.trim()).filter(Boolean);
  })();

  const valoracionEconomica = mapearValoracionEconomicaParaInforme(orden);

  const formulario = {
    cliente_id: orden?.clientes?.id || orden?.cliente_id || '',
    tecnico_id: orden?.tecnicos?.id || orden?.tecnico_id || '',
    orden_id: orden?.id || id,
    prioridad: orden?.prioridad || 'media',
    tiempo_empleado: String(orden?.tiempo_empleado_minutos ?? ''),
    descripcion_problema: orden?.descripcion_averia || '',
    materialesTexto: '',
  };

  const reservaInforme = await reservarReferenciaInforme(id);

  const { pdfUrl } = await generarYSubirInformeParte({
    parte: orden,
    formulario,
    seguimientoTiempo: null,
    desplazamiento: null,
    intervension: null,
    valoracionEconomica,
    clienteNombre: orden?.clientes?.nombre || '',
    equipoNombre: orden?.equipos?.nombre || '',
    tecnicoNombre: orden?.tecnicos?.nombre || '',
    nombreFirmante,
    firmaUrl: orden?.firma_url || '',
    fotosIntervencionUrls: fotos,
    secuencialDiario: reservaInforme.secuencialDiario,
    fechaInformeIso: orden?.fecha_fin || null,
    referenciaInforme: reservaInforme.referenciaInforme,
  });

  if (pdfUrl) {
    await guardarInformePdfUrl(id, { pdfUrl, referenciaInforme: reservaInforme.referenciaInforme });
  }

  return {
    ...orden,
    informe_pdf_url: pdfUrl || orden?.informe_pdf_url || null,
    referencia_informe: reservaInforme.referenciaInforme || orden?.referencia_informe || null,
  };
}

export async function editarParteFinalizado(ordenId, payload) {
  const id = limpiarTexto(ordenId);
  if (!id) {
    throw new Error('La orden a editar no es válida.');
  }
  const ordenes = await fetchJson('/ordenes');
  const ordenActual = Array.isArray(ordenes) ? ordenes.find((o) => o.id === id) : null;
  const clienteId = ordenActual?.clientes?.id || ordenActual?.cliente_id || 'tmp';
  const tecnicoId = ordenActual?.tecnicos?.id || ordenActual?.tecnico_id || 'tmp';

  const fotosNuevas = Array.isArray(payload?.fotos_nuevas) ? payload.fotos_nuevas : [];
  const refsNuevas = [];
  for (const foto of fotosNuevas) {
    const form = new FormData();
    form.append('bucket', 'fotos-intervenciones');
    form.append('pathPrefix', `${clienteId}/${tecnicoId}/${id}`);
    form.append('file', foto);
    const resp = await fetchJson('/storage/upload', { method: 'POST', body: form });
    if (resp?.reference) {
      refsNuevas.push(resp.reference);
    }
  }

  const actualizado = await fetchJson(`/ordenes/${id}/editar-parte`, {
    method: 'POST',
    body: {
      descripcion_averia: payload?.descripcion_averia,
      tareas_realizadas_libre: payload?.tareas_realizadas_libre,
      materiales: Array.isArray(payload?.materiales) ? payload.materiales : [],
      fotos_a_eliminar: Array.isArray(payload?.fotos_a_eliminar) ? payload.fotos_a_eliminar : [],
      fotos_nuevas: refsNuevas,
    },
  });

  const tareas = String(actualizado?.tareas_realizadas || '');
  const nombreFirmante = (() => {
    const m = /Firmado por:\s*([^|]+)/i.exec(tareas);
    return (m && m[1] ? m[1].trim() : '') || '';
  })();
  const fotos = (() => {
    const m = /Fotos intervención:\s*(.+)$/i.exec(tareas);
    if (!m || !m[1]) return [];
    return m[1].split('|').map((u) => u.trim()).filter(Boolean);
  })();

  const valoracionEconomica = mapearValoracionEconomicaParaInforme(actualizado);

  const formulario = {
    cliente_id: actualizado?.clientes?.id || actualizado?.cliente_id || '',
    tecnico_id: actualizado?.tecnicos?.id || actualizado?.tecnico_id || '',
    orden_id: actualizado?.id || id,
    prioridad: actualizado?.prioridad || 'media',
    tiempo_empleado: String(actualizado?.tiempo_empleado_minutos ?? ''),
    descripcion_problema: actualizado?.descripcion_averia || '',
    materialesTexto: '',
  };

  const reservaInforme = await reservarReferenciaInforme(id);

  const { pdfUrl } = await generarYSubirInformeParte({
    parte: actualizado,
    formulario,
    seguimientoTiempo: null,
    desplazamiento: null,
    intervension: null,
    valoracionEconomica,
    clienteNombre: actualizado?.clientes?.nombre || '',
    equipoNombre: actualizado?.equipos?.nombre || '',
    tecnicoNombre: actualizado?.tecnicos?.nombre || '',
    nombreFirmante,
    firmaUrl: actualizado?.firma_url || '',
    fotosIntervencionUrls: fotos,
    secuencialDiario: reservaInforme.secuencialDiario,
    fechaInformeIso: actualizado?.fecha_fin || null,
    referenciaInforme: reservaInforme.referenciaInforme,
  });

  if (pdfUrl) {
    await guardarInformePdfUrl(id, { pdfUrl, referenciaInforme: reservaInforme.referenciaInforme });
  }

  return {
    ...actualizado,
    informe_pdf_url: pdfUrl || actualizado?.informe_pdf_url || null,
    referencia_informe: reservaInforme.referenciaInforme || actualizado?.referencia_informe || null,
  };
}
