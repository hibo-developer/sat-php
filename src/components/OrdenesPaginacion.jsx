function construirPaginasVisibles(totalPaginas, paginaActual) {
  return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    .filter((pagina) => pagina === 1 || pagina === totalPaginas || Math.abs(pagina - paginaActual) <= 1)
    .reduce((acc, pagina, idx, arr) => {
      if (idx > 0 && pagina - arr[idx - 1] > 1) {
        acc.push('...');
      }
      acc.push(pagina);
      return acc;
    }, []);
}

export function OrdenesPaginacion({
  paginaActual,
  totalPaginas,
  totalOrdenes,
  onChangePagina,
}) {
  const paginasVisibles = construirPaginasVisibles(totalPaginas, paginaActual);

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <p className="text-xs font-semibold">
        Página {paginaActual} de {totalPaginas} · {totalOrdenes} órdenes
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={paginaActual === 1}
          onClick={() => onChangePagina(1)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
          title="Primera página"
        >
          «
        </button>
        <button
          type="button"
          disabled={paginaActual === 1}
          onClick={() => onChangePagina(paginaActual - 1)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
          title="Página anterior"
        >
          ‹
        </button>
        {paginasVisibles.map((pagina, idx) =>
          pagina === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={pagina}
              type="button"
              onClick={() => onChangePagina(pagina)}
              className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                pagina === paginaActual
                  ? 'border-cotepa-rojo-500 bg-cotepa-rojo-500 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {pagina}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={paginaActual === totalPaginas}
          onClick={() => onChangePagina(paginaActual + 1)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
          title="Página siguiente"
        >
          ›
        </button>
        <button
          type="button"
          disabled={paginaActual === totalPaginas}
          onClick={() => onChangePagina(totalPaginas)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
          title="Última página"
        >
          »
        </button>
      </div>
    </div>
  );
}
