import { useEffect, useMemo } from 'react';

const ORDENES_POR_PAGINA = 8;

export function useListaOrdenesAnalitica({
  ordenes,
  ordenesPagina,
  ordenesFiltradas,
  paginacion,
  paginaActual,
  setPaginaActual,
  rolUsuario,
  filtroClienteAnalisis,
  setFiltroClienteAnalisis,
  busquedaOrdenesDebounce,
}) {
  const clientesAnalisis = useMemo(() => {
    const mapa = new Map();
    ordenes.forEach((orden) => {
      const id = orden.clienteId || '';
      const nombre = orden.cliente || 'Cliente sin nombre';
      if (id && !mapa.has(id)) {
        mapa.set(id, nombre);
      }
    });

    return Array.from(mapa.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-ES'));
  }, [ordenes]);

  useEffect(() => {
    if (filtroClienteAnalisis === 'todos') {
      return;
    }

    const existeCliente = clientesAnalisis.some((cliente) => cliente.id === filtroClienteAnalisis);
    if (!existeCliente) {
      setFiltroClienteAnalisis('todos');
    }
  }, [clientesAnalisis, filtroClienteAnalisis, setFiltroClienteAnalisis]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busquedaOrdenesDebounce, setPaginaActual]);

  const ordenesAnalisis = useMemo(
    () => (filtroClienteAnalisis === 'todos'
      ? ordenesFiltradas
      : ordenesFiltradas.filter((orden) => orden.clienteId === filtroClienteAnalisis)),
    [filtroClienteAnalisis, ordenesFiltradas],
  );

  const resumenAnalisis = useMemo(
    () => ordenesAnalisis.reduce(
      (acc, orden) => {
        acc[orden.estado] = (acc[orden.estado] || 0) + 1;
        return acc;
      },
      { Pendiente: 0, 'En Proceso': 0, Pausado: 0, Finalizado: 0 },
    ),
    [ordenesAnalisis],
  );

  const ordenesFinalizadas = useMemo(
    () => ordenesAnalisis.filter((orden) => orden.estado === 'Finalizado'),
    [ordenesAnalisis],
  );

  const informesExportables = useMemo(
    () => ordenesFinalizadas.filter((orden) => orden.informePdfUrl),
    [ordenesFinalizadas],
  );

  const terminoBusqueda = busquedaOrdenesDebounce.trim().toLowerCase();

  const ordenesListado = useMemo(
    () => (terminoBusqueda
      ? ordenesFiltradas.filter((orden) => {
        const campos = [
          orden.numero_ticket,
          orden.cliente,
          orden.equipo,
          orden.tecnico,
          orden.descripcion,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return campos.includes(terminoBusqueda);
      })
      : ordenesPagina),
    [ordenesFiltradas, ordenesPagina, terminoBusqueda],
  );

  const usandoBusquedaLocal = terminoBusqueda.length > 0;
  const totalOrdenesFiltradas = usandoBusquedaLocal
    ? ordenesListado.length
    : Number(paginacion.total || ordenesFiltradas.length);
  const totalPaginas = usandoBusquedaLocal
    ? Math.max(1, Math.ceil(totalOrdenesFiltradas / ORDENES_POR_PAGINA))
    : Math.max(1, Number(paginacion.total_pages) || 1);
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const ordenesPaginadas = usandoBusquedaLocal
    ? ordenesListado.slice((paginaSegura - 1) * ORDENES_POR_PAGINA, paginaSegura * ORDENES_POR_PAGINA)
    : ordenesListado;

  const esTecnico = rolUsuario === 'tecnico';
  const puedeCrearOrdenes = rolUsuario !== 'tecnico';
  const puedeEditarOrden = rolUsuario !== 'tecnico';
  const puedeValorarFinalizada = rolUsuario === 'admin';
  const puedeEliminarOrden = rolUsuario === 'admin';

  const mttrMinutos = ordenesFinalizadas.length
    ? Math.round(
      ordenesFinalizadas.reduce((acc, orden) => acc + Number(orden.tiempoEmpleadoMinutos || 0), 0)
        / ordenesFinalizadas.length,
    )
    : 0;

  const cumplimientoSla48h = ordenesFinalizadas.length
    ? Math.round(
      (ordenesFinalizadas.filter((orden) => {
        const inicio = orden.fechaInicioIso ? new Date(orden.fechaInicioIso).getTime() : NaN;
        const fin = orden.fechaFinIso ? new Date(orden.fechaFinIso).getTime() : NaN;
        if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return false;
        const horas = (fin - inicio) / (1000 * 60 * 60);
        return horas <= 48;
      }).length / ordenesFinalizadas.length) * 100,
    )
    : 0;

  const firstTimeFixProxy = ordenesAnalisis.length
    ? Math.round((ordenesFinalizadas.length / ordenesAnalisis.length) * 100)
    : 0;

  const costeTotalMateriales = ordenesFinalizadas
    .reduce((acc, orden) => acc + Number(orden.costeMateriales || 0), 0)
    .toFixed(2);

  const clienteAnalisisSeleccionado = filtroClienteAnalisis === 'todos'
    ? 'Todos'
    : (clientesAnalisis.find((cliente) => cliente.id === filtroClienteAnalisis)?.nombre || 'Filtrado');

  return {
    clientesAnalisis,
    clienteAnalisisSeleccionado,
    ordenesAnalisis,
    resumenAnalisis,
    ordenesFinalizadas,
    informesExportables,
    informesDisponibles: informesExportables.length,
    ordenesPaginadas,
    totalOrdenesFiltradas,
    totalPaginas,
    paginaSegura,
    esTecnico,
    puedeCrearOrdenes,
    puedeEditarOrden,
    puedeValorarFinalizada,
    puedeEliminarOrden,
    mttrMinutos,
    cumplimientoSla48h,
    firstTimeFixProxy,
    costeTotalMateriales,
  };
}
