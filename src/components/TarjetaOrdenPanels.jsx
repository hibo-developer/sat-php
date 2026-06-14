export function PanelOrdenFinalizada({
  orden,
  descargandoInforme,
  onDescargarInformePdf,
  puedeValorarFinalizada,
  mostrarValoracion,
  onToggleMostrarValoracion,
  formularioValoracion,
  bloqueEditarParte,
  bloqueEliminar,
}) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      {orden.informePdfUrl && (
        <button
          type="button"
          onClick={onDescargarInformePdf}
          disabled={descargandoInforme}
          className="inline-flex rounded-lg bg-marca-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {descargandoInforme ? 'Generando enlace...' : 'Descargar informe PDF'}
        </button>
      )}
      {!orden.informePdfUrl && (
        <p className="text-xs font-semibold text-emerald-800">
          Informe PDF pendiente: el administrador debe completar la valoración económica para generarlo.
        </p>
      )}

      {puedeValorarFinalizada && (
        <>
          <button
            type="button"
            onClick={onToggleMostrarValoracion}
            className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800"
          >
            {mostrarValoracion ? 'Cancelar valoración' : 'Editar valoración y regenerar informe'}
          </button>

          {mostrarValoracion && formularioValoracion}
        </>
      )}

      {puedeValorarFinalizada && bloqueEditarParte}
      {bloqueEliminar}
    </div>
  );
}

export function PanelOrdenActiva({
  orden,
  puedeEditarOrden,
  mostrarEdicion,
  onToggleMostrarEdicion,
  onIrAParte,
  formularioEdicion,
  bloqueEliminar,
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className={`grid gap-2 ${puedeEditarOrden ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {puedeEditarOrden && (
          <button
            type="button"
            onClick={onToggleMostrarEdicion}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 active:scale-95"
          >
            {mostrarEdicion ? 'Cancelar edición' : 'Editar orden'}
          </button>
        )}
        <button
          type="button"
          onClick={() => onIrAParte(orden)}
          className="w-full rounded-xl border border-marca-300 bg-marca-50 px-4 py-3 text-sm font-bold text-marca-800 active:scale-95"
        >
          Ir a parte
        </button>
        <button
          type="button"
          onClick={() => onIrAParte(orden)}
          className="w-full rounded-xl bg-cotepa-rojo-500 px-4 py-3 text-sm font-bold text-white active:scale-95"
        >
          Finalizar con informe
        </button>
      </div>

      {mostrarEdicion && puedeEditarOrden && formularioEdicion}
      {bloqueEliminar}
    </div>
  );
}
