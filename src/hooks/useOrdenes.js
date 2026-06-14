import { useEffect, useMemo, useState } from 'react';
import { obtenerOrdenes } from '../services/ordenesService';

import {
  actualizarValoracionOrdenFinalizada,
  crearOrdenTrabajo,
  editarParteFinalizado,
  finalizarOrdenTrabajo,
  obtenerOrdenesTrabajo,
  obtenerOrdenesTrabajoPaginadas,
} from '../services/workOrderApiService';
import { tieneBackendApi } from '../services/backendClient';
import {
  estaOnline,
  intentarActualizarOrden,
  intentarEliminarOrden,
  obtenerOrdenesCacheadas,
  procesarCola,
  reemplazarCacheOrdenes,
} from '../services/offlineSyncService';

function estadoBackendAUi(estado) {
  const mapa = {
    pendiente: 'Pendiente',
    en_proceso: 'En Proceso',
    pausado: 'Pausado',
    finalizado: 'Finalizado',
  };

  return mapa[estado] || 'Pendiente';
}

function extraerTiempoMinutos(tareasRealizadas) {
  const coincidencia = /Tiempo empleado:\s*(\d+)\s*minutos/i.exec(tareasRealizadas || '');

  if (!coincidencia) {
    return null;
  }

  const minutos = Number.parseInt(coincidencia[1], 10);
  return Number.isFinite(minutos) ? minutos : null;
}

function extraerFotosIntervencionDesdeTareas(tareasRealizadas) {
  const texto = String(tareasRealizadas || '');
  const coincidencia = /Fotos intervención:\s*(.+)$/i.exec(texto);
  if (!coincidencia || !coincidencia[1]) return [];
  return coincidencia[1].split('|').map((u) => u.trim()).filter(Boolean);
}

function extraerKmFacturables(tareasRealizadas) {
  const texto = String(tareasRealizadas || '');
  const coincidencia = /Distancia (?:ida|desplazamiento):[^|]*\|\s*Factura \(ida\+vuelta\):\s*([\d.,]+)\s*km/i.exec(texto);
  if (!coincidencia) {
    return null;
  }

  const km = Number.parseFloat(coincidencia[1].replace(',', '.'));
  return Number.isFinite(km) ? Number(km.toFixed(2)) : null;
}

function calcularHorasManoObraPorContador(tiempoEmpleadoMinutos) {
  const minutos = Number(tiempoEmpleadoMinutos);
  if (!Number.isFinite(minutos) || minutos <= 0) {
    return 1;
  }

  return minutos < 60 ? 1 : Number((minutos / 60).toFixed(2));
}

function adaptarOrdenBackend(orden) {
  const materiales = Array.isArray(orden.materiales_orden) ? orden.materiales_orden : [];
  const costeMateriales = materiales.reduce((total, material) => {
    const cantidad = Number(material.cantidad || 0);
    const precioUnitario = Number(material.precio_unitario || 0);

    return total + cantidad * precioUnitario;
  }, 0);
  const tareasRealizadas = orden.tareas_realizadas || '';
  const tiempoEmpleadoMinutos = Number.isFinite(Number(orden.tiempo_empleado_minutos))
    ? Number(orden.tiempo_empleado_minutos)
    : extraerTiempoMinutos(tareasRealizadas);
  const kmFacturablesCalculados = extraerKmFacturables(tareasRealizadas);
  const horasManoObraCalculadas = calcularHorasManoObraPorContador(tiempoEmpleadoMinutos);

  return {
    id: orden.id,
    numero_ticket: orden.numero_ticket,
    clienteId: orden.clientes?.id || '',
    cliente: orden.clientes?.nombre || 'Cliente sin nombre',
    equipoId: orden.equipos?.id || '',
    equipo: orden.equipos?.nombre || 'Equipo no especificado',
    tecnicoId: orden.tecnicos?.id || '',
    tecnico: orden.tecnicos?.nombre || 'Sin técnico asignado',
    descripcion: orden.descripcion_averia,
    tareasRealizadas,
    fotoUrl: orden.foto_url || '',
    materiales,
    costeMateriales,
    costeMaterialesEditable: orden.coste_materiales_editable != null && Number.isFinite(Number(orden.coste_materiales_editable))
      ? Number(orden.coste_materiales_editable)
      : costeMateriales,
    tarifaManoObraHora: orden.tarifa_mano_obra_hora != null && Number.isFinite(Number(orden.tarifa_mano_obra_hora))
      ? Number(orden.tarifa_mano_obra_hora)
      : 50,
    horasManoObra: orden.horas_mano_obra != null && Number.isFinite(Number(orden.horas_mano_obra))
      ? Number(orden.horas_mano_obra)
      : horasManoObraCalculadas,
    mecanicosIntervinieron: orden.mecanicos_intervinieron != null && Number.isFinite(Number(orden.mecanicos_intervinieron))
      ? Math.max(1, Math.round(Number(orden.mecanicos_intervinieron)))
      : 1,
    tarifaDesplazamientoKm: orden.tarifa_desplazamiento_km != null && Number.isFinite(Number(orden.tarifa_desplazamiento_km))
      ? Number(orden.tarifa_desplazamiento_km)
      : 0.5,
    kmDesplazamientoFacturables: orden.km_desplazamiento_facturables != null && Number.isFinite(Number(orden.km_desplazamiento_facturables))
      ? Number(orden.km_desplazamiento_facturables)
      : (kmFacturablesCalculados ?? 0),
    recargoFestivoPct: orden.recargo_festivo_pct != null && Number.isFinite(Number(orden.recargo_festivo_pct))
      ? Number(orden.recargo_festivo_pct)
      : 25,
    recargoFueraHorarioPct: orden.recargo_fuera_horario_pct != null && Number.isFinite(Number(orden.recargo_fuera_horario_pct))
      ? Number(orden.recargo_fuera_horario_pct)
      : 20,
    aplicaRecargoFestivo: orden.aplica_recargo_festivo ?? null,
    aplicaRecargoFueraHorario: orden.aplica_recargo_fuera_horario ?? null,
    costeManoObraTotal: orden.coste_mano_obra_total != null && Number.isFinite(Number(orden.coste_mano_obra_total))
      ? Number(orden.coste_mano_obra_total)
      : 0,
    costeDesplazamientoTotal: orden.coste_desplazamiento_total != null && Number.isFinite(Number(orden.coste_desplazamiento_total))
      ? Number(orden.coste_desplazamiento_total)
      : 0,
    costeTotal: orden.coste_total != null && Number.isFinite(Number(orden.coste_total))
      ? Number(orden.coste_total)
      : costeMateriales,
    tiempoEmpleadoMinutos,
    fechaInicioIso: orden.fecha_inicio || null,
    fechaFinIso: orden.fecha_fin || null,
    informePdfUrl: orden.informe_pdf_url || '',
    referenciaInforme: orden.referencia_informe || '',
    estado: estadoBackendAUi(orden.estado),
    prioridad: orden.prioridad,
    fecha: new Date(orden.fecha_inicio).toLocaleDateString('es-ES'),
    fotosIntervencionUrls: extraerFotosIntervencionDesdeTareas(tareasRealizadas),
  };
}

const ORDENES_POR_PAGINA = 8;

function estadoUiABackend(estadoUi) {
  const mapa = {
    Pendiente: 'pendiente',
    'En Proceso': 'en_proceso',
    Pausado: 'pausado',
    Finalizado: 'finalizado',
  };
  return mapa[estadoUi] || null;
}

export function useOrdenes() {
  const [ordenes, setOrdenes] = useState([]);
  const [ordenesPagina, setOrdenesPagina] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorVariant, setErrorVariant] = useState('error');
  const [accionEnCurso, setAccionEnCurso] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('Todas');
  const [paginaActual, setPaginaActual] = useState(1);
  const [paginacion, setPaginacion] = useState({
    page: 1,
    limit: ORDENES_POR_PAGINA,
    total: 0,
    total_pages: 1,
    has_more: false,
  });

  function limpiarEstadoCarga() {
    setError('');
    setErrorVariant('error');
  }

  function mostrarEstadoCarga(mensaje, variant = 'error') {
    setError(mensaje);
    setErrorVariant(variant);
  }

  async function cargarOrdenes({ pagina = paginaActual, limpiarError = true } = {}) {
    setCargando(true);
    if (limpiarError) {
      limpiarEstadoCarga();
    }

    const estadoBackend = estadoUiABackend(filtroEstado);
    const filtrosBackend = estadoBackend ? { estado: [estadoBackend] } : {};

    try {
      if (tieneBackendApi()) {
        // 1) Pinta inmediatamente desde la caché local si existe.
        if (!estaOnline()) {
          const cache = await obtenerOrdenesCacheadas();
          const cacheAdaptada = cache.map(adaptarOrdenBackend);
          const cacheFiltrada = filtroEstado === 'Todas'
            ? cacheAdaptada
            : cacheAdaptada.filter((orden) => orden.estado === filtroEstado);
          const total = cacheFiltrada.length;
          const totalPages = Math.max(1, Math.ceil(total / ORDENES_POR_PAGINA));
          const paginaSegura = Math.min(Math.max(1, pagina), totalPages);

          setOrdenes(cacheFiltrada);
          setOrdenesPagina(
            cacheFiltrada.slice(
              (paginaSegura - 1) * ORDENES_POR_PAGINA,
              paginaSegura * ORDENES_POR_PAGINA,
            ),
          );
          setPaginacion({
            page: paginaSegura,
            limit: ORDENES_POR_PAGINA,
            total,
            total_pages: totalPages,
            has_more: paginaSegura < totalPages,
          });
          mostrarEstadoCarga('Sin conexión: mostrando datos guardados localmente.', 'neutral');
          return;
        }

        try {
          const [respuestaPagina, datosAnalisis] = await Promise.all([
            obtenerOrdenesTrabajoPaginadas({
              ...filtrosBackend,
              page: pagina,
              limit: ORDENES_POR_PAGINA,
            }),
            obtenerOrdenesTrabajo(filtrosBackend),
          ]);

          const itemsPagina = respuestaPagina.items.map(adaptarOrdenBackend);
          const itemsAnalisis = datosAnalisis.map(adaptarOrdenBackend);
          const pagination = respuestaPagina.pagination || {};
          const totalPages = Math.max(1, Number(pagination.total_pages) || 1);
          const paginaSegura = Math.min(Math.max(1, pagina), totalPages);

          setOrdenesPagina(itemsPagina);
          setOrdenes(itemsAnalisis);
          setPaginacion({
            page: Number(pagination.page) || paginaSegura,
            limit: Number(pagination.limit) || ORDENES_POR_PAGINA,
            total: Number(pagination.total) || itemsAnalisis.length,
            total_pages: totalPages,
            has_more: Boolean(pagination.has_more),
          });

          if (paginaSegura !== pagina) {
            setPaginaActual(paginaSegura);
          }

          // Refresca la caché para futuras sesiones offline.
          reemplazarCacheOrdenes(datosAnalisis).catch(() => { /* noop */ });
        } catch (errRed) {
          // Si la red falla a pesar de navigator.onLine, fallback a caché.
          const cache = await obtenerOrdenesCacheadas();
          if (cache.length) {
            const cacheAdaptada = cache.map(adaptarOrdenBackend);
            const cacheFiltrada = filtroEstado === 'Todas'
              ? cacheAdaptada
              : cacheAdaptada.filter((orden) => orden.estado === filtroEstado);
            const total = cacheFiltrada.length;
            const totalPages = Math.max(1, Math.ceil(total / ORDENES_POR_PAGINA));
            const paginaSegura = Math.min(Math.max(1, pagina), totalPages);

            setOrdenes(cacheFiltrada);
            setOrdenesPagina(
              cacheFiltrada.slice(
                (paginaSegura - 1) * ORDENES_POR_PAGINA,
                paginaSegura * ORDENES_POR_PAGINA,
              ),
            );
            setPaginacion({
              page: paginaSegura,
              limit: ORDENES_POR_PAGINA,
              total,
              total_pages: totalPages,
              has_more: paginaSegura < totalPages,
            });
            mostrarEstadoCarga('Conexión inestable: mostrando datos guardados localmente.', 'neutral');
          } else {
            throw errRed;
          }
        }
      } else {
        const datos = await obtenerOrdenes();
        setOrdenes(datos);
      }
    } catch (err) {
      mostrarEstadoCarga(err.message || 'No se pudieron cargar las órdenes.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarOrdenes({ pagina: paginaActual, limpiarError: true });

    // Cuando se recupera la conexión, drenamos la cola y recargamos datos.
    function alRecuperarConexion() {
      procesarCola()
        .catch(() => { /* noop */ })
        .finally(() => { cargarOrdenes({ pagina: paginaActual, limpiarError: false }); });
    }

    window.addEventListener('online', alRecuperarConexion);
    return () => { window.removeEventListener('online', alRecuperarConexion); };
  }, [filtroEstado, paginaActual]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroEstado]);

  async function crearOrdenDesdeFormulario(datosOrden) {
    setAccionEnCurso(true);
    limpiarEstadoCarga();

    try {
      await crearOrdenTrabajo(datosOrden);
      await cargarOrdenes({ pagina: paginaActual });
    } catch (err) {
      mostrarEstadoCarga(err.message || 'No se pudo crear la orden.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
  }

  async function finalizarOrden(idOrden, datosCierre) {
    setAccionEnCurso(true);
    limpiarEstadoCarga();

    try {
      await finalizarOrdenTrabajo(idOrden, datosCierre);
      await cargarOrdenes({ pagina: paginaActual });
    } catch (err) {
      mostrarEstadoCarga(err.message || 'No se pudo finalizar la orden.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
  }

  async function actualizarOrden(idOrden, datosOrden) {
    setAccionEnCurso(true);
    limpiarEstadoCarga();

    try {
      const resultado = await intentarActualizarOrden(idOrden, datosOrden);
      if (resultado.offline) {
        mostrarEstadoCarga('Sin conexión: cambios encolados, se sincronizarán al reconectar.', 'neutral');
      }
      await cargarOrdenes({ pagina: paginaActual, limpiarError: false });
    } catch (err) {
      mostrarEstadoCarga(err.message || 'No se pudo actualizar la orden.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
  }

  async function actualizarValoracionFinalizada(idOrden, datosValoracion) {
    setAccionEnCurso(true);
    limpiarEstadoCarga();

    try {
      await actualizarValoracionOrdenFinalizada(idOrden, datosValoracion);
      await cargarOrdenes({ pagina: paginaActual });
    } catch (err) {
      mostrarEstadoCarga(err.message || 'No se pudo actualizar la valoración y regenerar el informe.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
  }

  async function editarParteCompleto(idOrden, payloadEdicion) {
    setAccionEnCurso(true);
    limpiarEstadoCarga();

    try {
      await editarParteFinalizado(idOrden, payloadEdicion);
      await cargarOrdenes({ pagina: paginaActual });
    } catch (err) {
      mostrarEstadoCarga(err.message || 'No se pudo editar el parte y regenerar el informe.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
  }

  async function eliminarOrden(idOrden) {
    setAccionEnCurso(true);
    limpiarEstadoCarga();

    try {
      const resultado = await intentarEliminarOrden(idOrden);
      if (resultado.offline) {
        mostrarEstadoCarga('Sin conexión: eliminación encolada, se aplicará al reconectar.', 'neutral');
      }
      await cargarOrdenes({ pagina: paginaActual, limpiarError: false });
    } catch (err) {
      mostrarEstadoCarga(err.message || 'No se pudo eliminar la orden.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
  }

  async function recargarOrdenes() {
    await cargarOrdenes({ pagina: paginaActual, limpiarError: false });
  }

  const resumenPorEstado = useMemo(() => {
    return ordenes.reduce(
      (acc, orden) => {
        acc[orden.estado] = (acc[orden.estado] || 0) + 1;
        return acc;
      },
      { Pendiente: 0, 'En Proceso': 0, Pausado: 0, Finalizado: 0 }
    );
  }, [ordenes]);

  const ordenesFiltradas = useMemo(() => {
    return ordenes;
  }, [ordenes]);

  return {
    ordenes,
    ordenesPagina,
    ordenesFiltradas,
    cargando,
    error,
    errorVariant,
    accionEnCurso,
    resumenPorEstado,
    filtroEstado,
    setFiltroEstado,
    paginaActual,
    setPaginaActual,
    paginacion,
    crearOrdenDesdeFormulario,
    finalizarOrden,
    actualizarOrden,
    actualizarValoracionFinalizada,
    editarParteCompleto,
    eliminarOrden,
    recargarOrdenes,
  };
}
