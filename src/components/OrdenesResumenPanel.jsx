import { BarChart3, Download } from 'lucide-react';

const FILTROS_ESTADO = ['Todas', 'Pendiente', 'En Proceso', 'Pausado', 'Finalizado'];

export function OrdenesResumenPanel({
  esTecnico,
  informesDisponibles,
  exportandoZip,
  onExportarInformesZip,
  ordenesFinalizadasCount,
  onExportarKpisExcel,
  ordenesTotales,
  onExportarOrdenesExcel,
  ordenesAnalisisCount,
  filtroClienteAnalisis,
  onChangeFiltroClienteAnalisis,
  clientesAnalisis,
  mttrMinutos,
  cumplimientoSla48h,
  firstTimeFixProxy,
  costeTotalMateriales,
  resumenAnalisis,
  filtroEstado,
  onChangeFiltroEstado,
  busquedaOrdenes,
  onChangeBusquedaOrdenes,
}) {
  return (
    <>
      <div className={`mt-4 grid gap-2 ${esTecnico ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <article className="rounded-xl border border-white/20 bg-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Informes PDF</p>
            <Download className="h-4 w-4 text-white" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-white">{informesDisponibles}</p>
          <p className="text-xs text-slate-200">listos para incluir en ZIP</p>
          <button
            type="button"
            onClick={onExportarInformesZip}
            disabled={exportandoZip}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-marca-900 disabled:opacity-60"
          >
            {exportandoZip ? 'Generando ZIP...' : 'Descargar ZIP de informes'}
          </button>
        </article>

        {!esTecnico && (
          <article className="rounded-xl border border-white/20 bg-white/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">KPI</p>
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <p className="mt-2 text-xl font-extrabold text-white">{ordenesFinalizadasCount}</p>
            <p className="text-xs text-slate-200">órdenes finalizadas analizadas</p>
            <button
              type="button"
              onClick={onExportarKpisExcel}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-marca-900"
            >
              Descargar KPI Excel
            </button>
          </article>
        )}

        <article className="rounded-xl border border-white/20 bg-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Órdenes</p>
            <Download className="h-4 w-4 text-white" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-white">{ordenesTotales}</p>
          <p className="text-xs text-slate-200">registros totales exportables</p>
          <button
            type="button"
            onClick={onExportarOrdenesExcel}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-marca-900"
          >
            Descargar Excel de órdenes
          </button>
        </article>
      </div>

      <div className="mt-3 rounded-xl border border-white/15 bg-white/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Ámbito de análisis</p>
          <span className="text-[11px] font-semibold text-slate-300">{ordenesAnalisisCount} órdenes en análisis</span>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-semibold text-slate-200">Filtrar por cliente</span>
          <select
            value={filtroClienteAnalisis}
            onChange={(evento) => onChangeFiltroClienteAnalisis(evento.target.value)}
            className="w-full rounded-lg border border-white/20 bg-marca-900 px-3 py-2 text-sm text-white"
          >
            <option value="todos">Todos los clientes</option>
            {clientesAnalisis.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!esTecnico && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-bold lg:grid-cols-4">
          <div className="rounded-xl bg-white/10 p-2">
            <p className="text-slate-300">MTTR</p>
            <p className="text-base text-white">{mttrMinutos} min</p>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <p className="text-slate-300">SLA 48h</p>
            <p className="text-base text-white">{cumplimientoSla48h}%</p>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <p className="text-slate-300">FTF proxy</p>
            <p className="text-base text-white">{firstTimeFixProxy}%</p>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <p className="text-slate-300">Coste mat.</p>
            <p className="text-base text-white">{costeTotalMateriales} €</p>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
        <div className="rounded-xl bg-white/10 p-2">
          <p className="text-slate-300">Pendientes</p>
          <p className="text-base text-white">{resumenAnalisis.Pendiente}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-2">
          <p className="text-slate-300">En Proceso</p>
          <p className="text-base text-white">{resumenAnalisis['En Proceso']}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-2">
          <p className="text-slate-300">Finalizadas</p>
          <p className="text-base text-white">{resumenAnalisis.Finalizado}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTROS_ESTADO.map((filtro) => (
          <button
            key={filtro}
            type="button"
            onClick={() => onChangeFiltroEstado(filtro)}
            className={`rounded-full px-3 py-2 text-xs font-bold transition ${
              filtroEstado === filtro ? 'bg-cotepa-rojo-500 text-white' : 'bg-white/10 text-white'
            }`}
          >
            {filtro}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-200">Buscar orden</span>
          <input
            value={busquedaOrdenes}
            onChange={(evento) => onChangeBusquedaOrdenes(evento.target.value)}
            className="w-full rounded-lg border border-white/20 bg-marca-900 px-3 py-2 text-sm text-white placeholder:text-slate-300"
            placeholder="Ticket, cliente, equipo o técnico"
          />
        </label>
      </div>
    </>
  );
}
