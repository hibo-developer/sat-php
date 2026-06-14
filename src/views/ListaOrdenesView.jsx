import { useState } from 'react';
import { EstadoVacioContenido } from '../components/EstadoVacioContenido';
import { FormularioNuevaOrden } from '../components/FormularioNuevaOrden';
import { OrdenesListado } from '../components/OrdenesListado';
import { OrdenesPaginacion } from '../components/OrdenesPaginacion';
import { OrdenesResumenPanel } from '../components/OrdenesResumenPanel';
import { TarjetaOrden } from '../components/TarjetaOrden';
import { ToastEstado } from '../components/ToastEstado';
import { useListaOrdenesActions } from '../hooks/useListaOrdenesActions';
import { useListaOrdenesAnalitica } from '../hooks/useListaOrdenesAnalitica';
import { useOrdenesExportacion } from '../hooks/useOrdenesExportacion';
import { useTecnicosActivos } from '../hooks/useTecnicosActivos';
import { useOrdenes } from '../hooks/useOrdenes';
import { useDebounce } from '../hooks/useDebounce';

export function ListaOrdenesView({ rolUsuario }) {
  const tecnicosActivos = useTecnicosActivos();
  const [filtroClienteAnalisis, setFiltroClienteAnalisis] = useState('todos');
  const [busquedaOrdenes, setBusquedaOrdenes] = useState('');
  const busquedaOrdenesDebounce = useDebounce(busquedaOrdenes, 200);
  const {
    toast,
    notificar,
    cerrarToast,
    irAParteDesdeOrden,
  } = useListaOrdenesActions();
  const {
    ordenes,
    ordenesPagina,
    ordenesFiltradas,
    cargando,
    error,
    errorVariant,
    accionEnCurso,
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
  } = useOrdenes();

  const {
    clientesAnalisis,
    clienteAnalisisSeleccionado,
    ordenesAnalisis,
    resumenAnalisis,
    ordenesFinalizadas,
    informesExportables,
    informesDisponibles,
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
  } = useListaOrdenesAnalitica({
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
  });
  const {
    exportandoZip,
    exportarOrdenesExcel,
    exportarKpisExcel,
    exportarInformesZip,
  } = useOrdenesExportacion({
    ordenesAnalisis,
    ordenesFinalizadas,
    informesExportables,
    clienteAnalisisSeleccionado,
    mttrMinutos,
    cumplimientoSla48h,
    firstTimeFixProxy,
    costeTotalMateriales,
    onNotificar: notificar,
  });

  if (cargando) {
    return <p className="text-sm font-semibold text-slate-600">Cargando órdenes...</p>;
  }

  const renderTarjetaOrden = (orden) => (
    <TarjetaOrden
      key={orden.id}
      orden={orden}
      tecnicosActivos={tecnicosActivos}
      accionEnCurso={accionEnCurso}
      onActualizar={actualizarOrden}
      onValorarFinalizada={actualizarValoracionFinalizada}
      onEditarParteCompleto={editarParteCompleto}
      onEliminar={eliminarOrden}
      onNotificar={notificar}
      onIrAParte={irAParteDesdeOrden}
      puedeEditarOrden={puedeEditarOrden}
      puedeValorarFinalizada={puedeValorarFinalizada}
      puedeEliminarOrden={puedeEliminarOrden}
    />
  );

  return (
    <section className="space-y-4 lg:space-y-5">
      <ToastEstado toast={toast} onClose={cerrarToast} />

      {error && <EstadoVacioContenido mensaje={error} variant={errorVariant} />}

      <header className="rounded-2xl bg-marca-900 p-4 text-white shadow-lg lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Órdenes de Trabajo</h2>
            <p className="mt-1 text-sm text-slate-200">
              Consulta, crea y actualiza el estado de cada avería desde el móvil.
            </p>
          </div>
          <button
            type="button"
            onClick={recargarOrdenes}
            disabled={cargando || accionEnCurso}
            className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {cargando ? 'Actualizando...' : 'Actualizar datos'}
          </button>
        </div>

        <OrdenesResumenPanel
          esTecnico={esTecnico}
          informesDisponibles={informesDisponibles}
          exportandoZip={exportandoZip}
          onExportarInformesZip={exportarInformesZip}
          ordenesFinalizadasCount={ordenesFinalizadas.length}
          onExportarKpisExcel={exportarKpisExcel}
          ordenesTotales={ordenes.length}
          onExportarOrdenesExcel={exportarOrdenesExcel}
          ordenesAnalisisCount={ordenesAnalisis.length}
          filtroClienteAnalisis={filtroClienteAnalisis}
          onChangeFiltroClienteAnalisis={setFiltroClienteAnalisis}
          clientesAnalisis={clientesAnalisis}
          mttrMinutos={mttrMinutos}
          cumplimientoSla48h={cumplimientoSla48h}
          firstTimeFixProxy={firstTimeFixProxy}
          costeTotalMateriales={costeTotalMateriales}
          resumenAnalisis={resumenAnalisis}
          filtroEstado={filtroEstado}
          onChangeFiltroEstado={setFiltroEstado}
          busquedaOrdenes={busquedaOrdenes}
          onChangeBusquedaOrdenes={setBusquedaOrdenes}
        />
      </header>

      <div className="lg:grid lg:grid-cols-12 lg:gap-4">
        <div className="lg:col-span-4 lg:sticky lg:top-5 lg:self-start">
          <FormularioNuevaOrden
            onCrear={crearOrdenDesdeFormulario}
            accionEnCurso={accionEnCurso}
            onNotificar={notificar}
            puedeCrearOrdenes={puedeCrearOrdenes}
          />
        </div>

        <div className="space-y-3 pb-20 lg:col-span-8 lg:pb-0">
          <OrdenesListado
            ordenes={ordenesPaginadas}
            renderOrden={renderTarjetaOrden}
            mensajeVacio="No hay órdenes disponibles con los filtros y búsqueda seleccionados."
          />

          {totalPaginas > 1 && (
            <OrdenesPaginacion
              paginaActual={paginaSegura}
              totalPaginas={totalPaginas}
              totalOrdenes={totalOrdenesFiltradas}
              onChangePagina={setPaginaActual}
            />
          )}
        </div>
      </div>
    </section>
  );
}
