import { CircleCheckBig, Clock3, Hammer, TriangleAlert } from 'lucide-react';
import { BloqueEditarParteCompleto, BloqueEliminarOrden } from './TarjetaOrdenExtras';
import { PanelOrdenActiva, PanelOrdenFinalizada } from './TarjetaOrdenPanels';
import { FormularioEdicionOrden, FormularioValoracionOrdenFinalizada } from './TarjetaOrdenForms';
import { useTarjetaOrden } from '../hooks/useTarjetaOrden';

const estilosEstado = {
  Pendiente: {
    icono: Clock3,
    clase: 'bg-amber-100 text-amber-800',
  },
  'En Proceso': {
    icono: Hammer,
    clase: 'bg-sky-100 text-sky-800',
  },
  Finalizado: {
    icono: CircleCheckBig,
    clase: 'bg-emerald-100 text-emerald-800',
  },
  Pausado: {
    icono: TriangleAlert,
    clase: 'bg-orange-100 text-orange-800',
  },
};

const OPCIONES_ESTADO_EDITABLE = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'pausado', label: 'Pausado' },
];

export function TarjetaOrden({
  orden,
  tecnicosActivos,
  accionEnCurso,
  onActualizar,
  onValorarFinalizada,
  onEditarParteCompleto,
  onEliminar,
  onNotificar,
  onIrAParte,
  puedeEditarOrden,
  puedeValorarFinalizada,
  puedeEliminarOrden,
}) {
  const { icono: IconoEstado, clase } = estilosEstado[orden.estado] || estilosEstado.Pendiente;
  const {
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
    materialesCompartidos,
    actualizarMaterialCompartido,
    eliminarMaterialCompartido,
    agregarMaterialCompartido,
    guardarParteCompletoSincronizado,
    totalMaterialesCalculado,
    totalMaterialesValoracion,
    hayDiscrepanciaMateriales,
    mensajeDiscrepanciaMateriales,
    alinearValoracionConMateriales,
    costeManoObraBasePreview,
    porcentajeRecargoManoObraPreview,
    recargoManoObraEurosPreview,
    costeManoObraPreview,
    costeDesplazamientoPreview,
    costeTotalPreview,
  } = useTarjetaOrden({
    orden,
    onActualizar,
    onValorarFinalizada,
    onEditarParteCompleto,
    onEliminar,
    onNotificar,
  });

  const bloqueEliminarFinalizada = puedeEliminarOrden ? (
    <BloqueEliminarOrden
      orden={orden}
      mostrarEliminar={mostrarEliminar}
      copiaGuardada={copiaGuardada}
      accionEnCurso={accionEnCurso}
      mensajeEliminacion={mensajeEliminacion}
      onAlternarEliminar={alternarEliminar}
      onDescargarCopiaJsonOrden={descargarCopiaJsonOrden}
      onCambiarCopiaGuardada={setCopiaGuardada}
      onConfirmarEliminacion={confirmarEliminacion}
      claseBotonToggle="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700"
    />
  ) : null;

  const bloqueEliminarActiva = puedeEliminarOrden ? (
    <BloqueEliminarOrden
      orden={orden}
      mostrarEliminar={mostrarEliminar}
      copiaGuardada={copiaGuardada}
      accionEnCurso={accionEnCurso}
      mensajeEliminacion={mensajeEliminacion}
      onAlternarEliminar={alternarEliminar}
      onDescargarCopiaJsonOrden={descargarCopiaJsonOrden}
      onDescargarInformePdf={descargarInformePdf}
      onCambiarCopiaGuardada={setCopiaGuardada}
      onConfirmarEliminacion={confirmarEliminacion}
      claseBotonToggle="w-full rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 active:scale-95"
    />
  ) : null;

  return (
    <article className="rounded-2xl border border-marca-100 bg-white p-4 shadow-tarjeta">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {orden.numero_ticket ? `SAT-${orden.numero_ticket}` : orden.id}
          </p>
          <h3 className="mt-1 text-base font-bold text-slate-800">{orden.equipo}</h3>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${clase}`}>
          <IconoEstado className="h-4 w-4" />
          {orden.estado}
        </span>
      </div>

      <div className="space-y-2 text-sm text-slate-700">
        <p>
          <span className="font-semibold text-slate-900">Cliente:</span> {orden.cliente}
        </p>
        <p>
          <span className="font-semibold text-slate-900">Técnico:</span> {orden.tecnico || 'Sin técnico asignado'}
        </p>
        {orden.estado !== 'Finalizado' && (
          <p>
            <span className="font-semibold text-slate-900">Avería:</span> {orden.descripcion}
          </p>
        )}
      </div>

      {orden.estado !== 'Finalizado' && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-marca-50 px-3 py-2 text-xs font-semibold text-marca-700">
          <span>Prioridad: {orden.prioridad}</span>
          <span>{orden.fecha}</span>
        </div>
      )}

      {orden.estado === 'Finalizado' && (
        <PanelOrdenFinalizada
          orden={orden}
          descargandoInforme={descargandoInforme}
          onDescargarInformePdf={descargarInformePdf}
          puedeValorarFinalizada={puedeValorarFinalizada}
          mostrarValoracion={mostrarValoracion}
          onToggleMostrarValoracion={toggleMostrarValoracion}
          formularioValoracion={(
            <FormularioValoracionOrdenFinalizada
              formularioValoracion={formularioValoracion}
              onChangeFormularioValoracion={actualizarFormularioValoracion}
              onAlinearMateriales={alinearValoracionConMateriales}
              accionEnCurso={accionEnCurso}
              mensajeValoracion={mensajeValoracion}
              mensajeDiscrepanciaMateriales={mensajeDiscrepanciaMateriales}
              hayDiscrepanciaMateriales={hayDiscrepanciaMateriales}
              totalMaterialesCalculado={totalMaterialesCalculado}
              onSubmit={guardarValoracion}
              costeManoObraBasePreview={costeManoObraBasePreview}
              porcentajeRecargoManoObraPreview={porcentajeRecargoManoObraPreview}
              recargoManoObraEurosPreview={recargoManoObraEurosPreview}
              costeManoObraPreview={costeManoObraPreview}
              costeDesplazamientoPreview={costeDesplazamientoPreview}
              costeTotalPreview={costeTotalPreview}
            />
          )}
          bloqueEditarParte={puedeValorarFinalizada ? (
            <BloqueEditarParteCompleto
              orden={orden}
              accionEnCurso={accionEnCurso}
              onGuardarParteCompleto={guardarParteCompletoSincronizado}
              onNotificar={onNotificar}
              materiales={materialesCompartidos}
              onActualizarMaterial={actualizarMaterialCompartido}
              onEliminarMaterial={eliminarMaterialCompartido}
              onAgregarMaterial={agregarMaterialCompartido}
              costeMaterialesValoracion={formularioValoracion.coste_materiales_editable}
              totalMaterialesCalculado={totalMaterialesCalculado}
              hayDiscrepanciaMateriales={hayDiscrepanciaMateriales}
              mensajeDiscrepanciaMateriales={mensajeDiscrepanciaMateriales}
              onAlinearMateriales={alinearValoracionConMateriales}
              onActualizarCosteMaterialesValoracion={(valor) => actualizarFormularioValoracion({ coste_materiales_editable: valor })}
            />
          ) : null}
          bloqueEliminar={bloqueEliminarFinalizada}
        />
      )}

      {orden.estado !== 'Finalizado' && (
        <PanelOrdenActiva
          orden={orden}
          puedeEditarOrden={puedeEditarOrden}
          mostrarEdicion={mostrarEdicion}
          onToggleMostrarEdicion={toggleMostrarEdicion}
          onIrAParte={onIrAParte}
          formularioEdicion={(
            <FormularioEdicionOrden
              formularioEdicion={formularioEdicion}
              onChangeFormularioEdicion={actualizarFormularioEdicion}
              tecnicosActivos={tecnicosActivos}
              accionEnCurso={accionEnCurso}
              mensajeEdicion={mensajeEdicion}
              onSubmit={guardarEdicion}
              opcionesEstado={OPCIONES_ESTADO_EDITABLE}
            />
          )}
          bloqueEliminar={bloqueEliminarActiva}
        />
      )}
    </article>
  );
}
