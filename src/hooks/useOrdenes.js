import { useEffect, useMemo, useState } from 'react';
import { obtenerOrdenes } from '../services/ordenesService';

import {
  actualizarOrdenTrabajo,
  crearOrdenTrabajo,
  finalizarOrdenTrabajo,
  obtenerOrdenesTrabajo,
} from '../services/workOrderService';
import { tieneConfiguracionSupabase } from '../services/supabaseClient';

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

function adaptarOrdenSupabase(orden) {
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
    tiempoEmpleadoMinutos,
    fechaInicioIso: orden.fecha_inicio || null,
    fechaFinIso: orden.fecha_fin || null,
    informePdfUrl: orden.informe_pdf_url || '',
    estado: estadoBackendAUi(orden.estado),
    prioridad: orden.prioridad,
    fecha: new Date(orden.fecha_inicio).toLocaleDateString('es-ES'),
  };
}

export function useOrdenes() {
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [accionEnCurso, setAccionEnCurso] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('Todas');

  async function cargarOrdenes() {
    setCargando(true);
    setError('');

    try {
      if (tieneConfiguracionSupabase()) {
        const datos = await obtenerOrdenesTrabajo();
        setOrdenes(datos.map(adaptarOrdenSupabase));
      } else {
        const datos = await obtenerOrdenes();
        setOrdenes(datos);
      }
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las órdenes.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarOrdenes();
  }, []);

  async function crearOrdenDesdeFormulario(datosOrden) {
    setAccionEnCurso(true);
    setError('');

    try {
      await crearOrdenTrabajo(datosOrden);
      await cargarOrdenes();
    } catch (err) {
      setError(err.message || 'No se pudo crear la orden.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
  }

  async function finalizarOrden(idOrden, datosCierre) {
    setAccionEnCurso(true);
    setError('');

    try {
      await finalizarOrdenTrabajo(idOrden, datosCierre);
      await cargarOrdenes();
    } catch (err) {
      setError(err.message || 'No se pudo finalizar la orden.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
  }

  async function actualizarOrden(idOrden, datosOrden) {
    setAccionEnCurso(true);
    setError('');

    try {
      await actualizarOrdenTrabajo(idOrden, datosOrden);
      await cargarOrdenes();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la orden.');
      throw err;
    } finally {
      setAccionEnCurso(false);
    }
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
    if (filtroEstado === 'Todas') {
      return ordenes;
    }

    return ordenes.filter((orden) => orden.estado === filtroEstado);
  }, [filtroEstado, ordenes]);

  return {
    ordenes,
    ordenesFiltradas,
    cargando,
    error,
    accionEnCurso,
    resumenPorEstado,
    filtroEstado,
    setFiltroEstado,
    crearOrdenDesdeFormulario,
    finalizarOrden,
    actualizarOrden,
  };
}
