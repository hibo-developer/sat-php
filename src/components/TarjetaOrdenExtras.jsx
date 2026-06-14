import { useEffect, useState } from 'react';
import { obtenerUrlFirmadaStorage } from '../services/backendClient';

export function BloqueEditarParteCompleto({
  orden,
  accionEnCurso,
  onGuardarParteCompleto,
  onNotificar,
  materiales,
  onActualizarMaterial,
  onEliminarMaterial,
  onAgregarMaterial,
  costeMaterialesValoracion,
  totalMaterialesCalculado,
  hayDiscrepanciaMateriales,
  mensajeDiscrepanciaMateriales,
  onAlinearMateriales,
  onActualizarCosteMaterialesValoracion,
}) {
  const [abierto, setAbierto] = useState(false);
  const [descripcionAveria, setDescripcionAveria] = useState(orden.descripcion || '');
  const [tareasLibre, setTareasLibre] = useState(() => {
    const texto = String(orden.tareasRealizadas || '');
    const primerBloque = texto.split('|')[0] || '';
    return primerBloque.trim();
  });
  const [fotosActuales, setFotosActuales] = useState(() =>
    Array.isArray(orden.fotosIntervencionUrls) ? [...orden.fotosIntervencionUrls] : [],
  );
  const [mapaFotosVista, setMapaFotosVista] = useState({});
  const [fotosAEliminar, setFotosAEliminar] = useState([]);
  const [fotosNuevas, setFotosNuevas] = useState([]);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setDescripcionAveria(orden.descripcion || '');
    setTareasLibre(() => {
      const texto = String(orden.tareasRealizadas || '');
      const primerBloque = texto.split('|')[0] || '';
      return primerBloque.trim();
    });
    const refs = Array.isArray(orden.fotosIntervencionUrls) ? [...orden.fotosIntervencionUrls] : [];
    setFotosActuales(refs);
    setFotosAEliminar([]);
    setFotosNuevas([]);
    setMensaje('');
    setMapaFotosVista({});
    Promise.all(
      refs.map(async (ref) => {
        const url = await obtenerUrlFirmadaStorage(ref, { expiresIn: 900 });
        return [ref, url];
      }),
    ).then((pares) => {
      setMapaFotosVista(Object.fromEntries(pares.filter(([k]) => k)));
    }).catch(() => {});
  }, [abierto, orden.descripcion, orden.tareasRealizadas, orden.fotosIntervencionUrls]);

  function alternarEliminarFoto(url) {
    setFotosAEliminar((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url],
    );
  }

  function aceptarFotosNuevas(evento) {
    const archivos = Array.from(evento.target.files || []);
    setFotosNuevas((prev) => [...prev, ...archivos]);
    evento.target.value = '';
  }

  function quitarFotoNueva(indice) {
    setFotosNuevas((prev) => prev.filter((_, i) => i !== indice));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setMensaje('');
    try {
      const tareasLibreTrim = String(tareasLibre || '').trim();
      await onGuardarParteCompleto(orden.id, {
        descripcion_averia: descripcionAveria,
        ...(tareasLibreTrim ? { tareas_realizadas_libre: tareasLibreTrim } : {}),
        fotos_a_eliminar: fotosAEliminar,
        fotos_nuevas: fotosNuevas,
      });
      setAbierto(false);
      setMensaje('Parte editado e informe regenerado.');
      onNotificar?.({
        tipo: 'exito',
        titulo: 'Parte actualizado',
        descripcion: 'Se guardaron los cambios y se regeneró el PDF del informe.',
      });
    } catch (err) {
      setMensaje(err.message || 'No se pudo editar el parte.');
      onNotificar?.({
        tipo: 'error',
        titulo: 'No se pudo editar el parte',
        descripcion: err.message || 'Revisa los cambios y vuelve a intentarlo.',
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((p) => !p)}
        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-800"
      >
        {abierto ? 'Cancelar edición del parte' : 'Editar parte completo (admin)'}
      </button>

      {abierto && (
        <form onSubmit={guardar} className="space-y-3 rounded-xl border border-sky-200 bg-white p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Descripción de la avería</span>
            <textarea
              rows={2}
              value={descripcionAveria}
              onChange={(e) => setDescripcionAveria(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">
              Tareas realizadas
            </span>
            <textarea
              rows={3}
              value={tareasLibre}
              onChange={(e) => setTareasLibre(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-[10px] text-slate-500">
              Los marcadores técnicos (firma, fotos…) se conservan.
            </span>
          </label>

          <fieldset className="space-y-2 rounded-lg border border-slate-200 p-2">
            <legend className="px-1 text-xs font-bold text-slate-700">Materiales</legend>
            {materiales.length === 0 && (
              <p className="text-xs text-slate-500">Sin materiales asociados.</p>
            )}
            {materiales.map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-1">
                <input
                  type="text"
                  value={m.nombre_material}
                  onChange={(e) => onActualizarMaterial(i, 'nombre_material', e.target.value)}
                  placeholder="Nombre"
                  className="col-span-6 rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={m.cantidad}
                  onChange={(e) => onActualizarMaterial(i, 'cantidad', e.target.value)}
                  placeholder="Cant."
                  className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={m.precio_unitario}
                  onChange={(e) => onActualizarMaterial(i, 'precio_unitario', e.target.value)}
                  placeholder="€/u"
                  className="col-span-3 rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => onEliminarMaterial(i)}
                  className="col-span-1 rounded bg-red-100 px-1 text-xs font-bold text-red-700"
                  title="Eliminar"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAgregarMaterial}
              className="w-full rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              + Añadir material
            </button>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Materiales facturados (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costeMaterialesValoracion}
                onChange={(e) => onActualizarCosteMaterialesValoracion(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <p className="text-[11px] text-slate-600">
              Suma calculada desde líneas de material: {totalMaterialesCalculado.toFixed(2)} €
            </p>
            {hayDiscrepanciaMateriales && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
                <p className="font-semibold">{mensajeDiscrepanciaMateriales}</p>
                <button
                  type="button"
                  onClick={onAlinearMateriales}
                  className="mt-2 rounded-lg border border-amber-400 bg-white px-2 py-1 font-semibold text-amber-800"
                >
                  Usar suma calculada
                </button>
              </div>
            )}
            <p className="text-[10px] text-slate-500">
              No se ajusta el stock de inventario al editar; solo cambia el detalle del informe.
            </p>
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border border-slate-200 p-2">
            <legend className="px-1 text-xs font-bold text-slate-700">Fotos del parte</legend>
            {fotosActuales.length === 0 && (
              <p className="text-xs text-slate-500">Sin fotos en el parte original.</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {fotosActuales.map((url) => {
                const marcada = fotosAEliminar.includes(url);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => alternarEliminarFoto(url)}
                    className={`relative overflow-hidden rounded border-2 ${marcada ? 'border-red-500 opacity-50' : 'border-slate-200'}`}
                  >
                    <img src={mapaFotosVista[url] || ''} alt="Foto" className="h-20 w-full object-cover" />
                    {marcada && (
                      <span className="absolute inset-0 flex items-center justify-center bg-red-500/40 text-xs font-bold text-white">
                        Eliminar
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {fotosAEliminar.length > 0 && (
              <p className="text-[11px] font-semibold text-red-700">
                {fotosAEliminar.length} foto(s) marcadas para eliminar.
              </p>
            )}
            <div className="border-t border-slate-200 pt-2">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Añadir fotos nuevas</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={aceptarFotosNuevas}
                className="block w-full text-xs"
              />
              {fotosNuevas.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {fotosNuevas.map((f, i) => (
                    <li key={i} className="flex items-center justify-between rounded bg-slate-100 px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => quitarFotoNueva(i)}
                        className="ml-2 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={accionEnCurso}
            className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {accionEnCurso ? 'Guardando y regenerando PDF...' : 'Guardar parte y regenerar informe'}
          </button>

          {mensaje && <p className="text-xs font-semibold text-slate-600">{mensaje}</p>}
        </form>
      )}
    </>
  );
}

export function BloqueEliminarOrden({
  orden,
  mostrarEliminar,
  copiaGuardada,
  accionEnCurso,
  mensajeEliminacion,
  onAlternarEliminar,
  onDescargarCopiaJsonOrden,
  onDescargarInformePdf,
  onCambiarCopiaGuardada,
  onConfirmarEliminacion,
  claseBotonToggle,
}) {
  return (
    <>
      <button
        type="button"
        onClick={onAlternarEliminar}
        className={claseBotonToggle}
      >
        {mostrarEliminar ? 'Cancelar eliminación' : 'Eliminar orden (admin)'}
      </button>

      {mostrarEliminar && (
        <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <p className="font-semibold">Antes de eliminar, guarda una copia del informe o de la orden.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onDescargarCopiaJsonOrden}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 font-bold text-rose-700"
            >
              Descargar copia JSON
            </button>
            <button
              type="button"
              onClick={onDescargarInformePdf}
              disabled={!orden.informePdfUrl || accionEnCurso}
              className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 font-bold ${orden.informePdfUrl ? 'border-rose-300 bg-white text-rose-700' : 'border-slate-300 bg-slate-100 text-slate-400 pointer-events-none'}`}
            >
              Descargar informe PDF
            </button>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 font-semibold text-rose-800">
            <input
              type="checkbox"
              checked={copiaGuardada}
              onChange={(evento) => onCambiarCopiaGuardada(evento.target.checked)}
            />
            Confirmo que ya guardé copia antes de eliminar.
          </label>
          <button
            type="button"
            onClick={onConfirmarEliminacion}
            disabled={accionEnCurso || !copiaGuardada}
            className="w-full rounded-lg bg-rose-600 px-3 py-2 font-bold text-white disabled:opacity-60"
          >
            {accionEnCurso ? 'Eliminando...' : 'Eliminar definitivamente'}
          </button>
          {mensajeEliminacion && <p className="font-semibold text-rose-700">{mensajeEliminacion}</p>}
        </div>
      )}
    </>
  );
}
