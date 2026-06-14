import { horasManoObraDesdeIntervencionDatetimeLocal } from '../services/ordenesViewUtils';
import { deduplicarTecnicosParaSelector } from '../services/tecnicosUtils';

export function FormularioValoracionOrdenFinalizada({
  formularioValoracion,
  onChangeFormularioValoracion,
  accionEnCurso,
  mensajeValoracion,
  onSubmit,
  costeManoObraBasePreview,
  porcentajeRecargoManoObraPreview,
  recargoManoObraEurosPreview,
  costeManoObraPreview,
  costeDesplazamientoPreview,
  costeTotalPreview,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-xl border border-emerald-200 bg-white p-3">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Materiales (€)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formularioValoracion.coste_materiales_editable}
          onChange={(evento) => onChangeFormularioValoracion({ coste_materiales_editable: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Tarifa mano de obra (€/h)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formularioValoracion.tarifa_mano_obra_hora}
          onChange={(evento) => onChangeFormularioValoracion({ tarifa_mano_obra_hora: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Horas mano de obra</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formularioValoracion.horas_mano_obra}
          onChange={(evento) => onChangeFormularioValoracion({ horas_mano_obra: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Mecánicos</span>
        <input
          type="number"
          min="1"
          step="1"
          value={formularioValoracion.mecanicos_intervinieron}
          onChange={(evento) => onChangeFormularioValoracion({ mecanicos_intervinieron: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">Inicio intervención</span>
          <input
            type="datetime-local"
            value={formularioValoracion.fecha_inicio}
            onChange={(evento) => {
              const siguienteFechaInicio = evento.target.value;
              const horas = horasManoObraDesdeIntervencionDatetimeLocal(
                siguienteFechaInicio,
                formularioValoracion.fecha_fin,
              );

              onChangeFormularioValoracion({
                fecha_inicio: siguienteFechaInicio,
                ...(horas != null ? { horas_mano_obra: horas } : {}),
              });
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">Fin intervención</span>
          <input
            type="datetime-local"
            value={formularioValoracion.fecha_fin}
            onChange={(evento) => {
              const siguienteFechaFin = evento.target.value;
              const horas = horasManoObraDesdeIntervencionDatetimeLocal(
                formularioValoracion.fecha_inicio,
                siguienteFechaFin,
              );

              onChangeFormularioValoracion({
                fecha_fin: siguienteFechaFin,
                ...(horas != null ? { horas_mano_obra: horas } : {}),
              });
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Tarifa desplazamiento (€/km)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formularioValoracion.tarifa_desplazamiento_km}
          onChange={(evento) => onChangeFormularioValoracion({ tarifa_desplazamiento_km: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Km desplazamiento facturables</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formularioValoracion.km_desplazamiento_facturables}
          onChange={(evento) =>
            onChangeFormularioValoracion({ km_desplazamiento_facturables: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
        <p className="font-semibold">Recargos mano de obra</p>
        <p>Horario estándar: 08:00 - 18:00</p>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(formularioValoracion.aplica_recargo_festivo)}
          onChange={(evento) => onChangeFormularioValoracion({ aplica_recargo_festivo: evento.target.checked })}
        />
        Aplicar recargo por festivo
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Recargo festivo (%)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formularioValoracion.recargo_festivo_pct}
          onChange={(evento) => onChangeFormularioValoracion({ recargo_festivo_pct: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(formularioValoracion.aplica_recargo_fuera_horario)}
          onChange={(evento) => onChangeFormularioValoracion({ aplica_recargo_fuera_horario: evento.target.checked })}
        />
        Aplicar recargo fuera de horario (08:00-18:00)
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Recargo fuera de horario (%)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formularioValoracion.recargo_fuera_horario_pct}
          onChange={(evento) => onChangeFormularioValoracion({ recargo_fuera_horario_pct: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
        <p>Mano de obra base: {costeManoObraBasePreview.toFixed(2)} €</p>
        <p>Recargo mano de obra ({porcentajeRecargoManoObraPreview.toFixed(2)}%): {recargoManoObraEurosPreview.toFixed(2)} €</p>
        <p>Mano de obra total: {costeManoObraPreview.toFixed(2)} €</p>
        <p>Desplazamiento: {costeDesplazamientoPreview.toFixed(2)} €</p>
        <p className="font-bold">Total: {costeTotalPreview.toFixed(2)} €</p>
      </div>

      <button
        type="submit"
        disabled={accionEnCurso}
        className="w-full rounded-xl bg-marca-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {accionEnCurso ? 'Guardando y regenerando...' : 'Guardar valoración y regenerar informe'}
      </button>

      {mensajeValoracion && <p className="text-xs font-semibold text-slate-600">{mensajeValoracion}</p>}
    </form>
  );
}

export function FormularioEdicionOrden({
  formularioEdicion,
  onChangeFormularioEdicion,
  tecnicosActivos,
  accionEnCurso,
  mensajeEdicion,
  onSubmit,
  opcionesEstado,
}) {
  const tecnicosUnicos = deduplicarTecnicosParaSelector(tecnicosActivos, formularioEdicion.tecnico_id);

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-xl border border-marca-100 bg-marca-50 p-3">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Técnico *</span>
        <select
          required
          value={formularioEdicion.tecnico_id}
          onChange={(evento) => onChangeFormularioEdicion({ tecnico_id: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Selecciona técnico</option>
          {tecnicosUnicos.map((tecnico) => (
            <option key={tecnico.id} value={tecnico.id}>
              {tecnico.nombre}
              {tecnico.especialidad ? ` (${tecnico.especialidad})` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Estado</span>
        <select
          value={formularioEdicion.estado}
          onChange={(evento) => onChangeFormularioEdicion({ estado: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {opcionesEstado.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Prioridad</span>
        <select
          value={formularioEdicion.prioridad}
          onChange={(evento) => onChangeFormularioEdicion({ prioridad: evento.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={accionEnCurso}
        className="w-full rounded-xl bg-marca-900 px-4 py-3 text-sm font-bold text-white active:scale-95 disabled:opacity-60"
      >
        {accionEnCurso ? 'Guardando cambios...' : 'Guardar cambios'}
      </button>

      {mensajeEdicion && <p className="text-xs font-semibold text-slate-600">{mensajeEdicion}</p>}
    </form>
  );
}
