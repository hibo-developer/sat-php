import { useEffect, useMemo, useState } from 'react';
import {
  actualizarMaterialInventario,
  crearMaterialInventario,
  eliminarMaterialInventario,
  listarMaterialesInventario,
} from '../services/inventarioMaterialesService';
import { tieneConfiguracionSupabase } from '../services/supabaseClient';

const FORM_MATERIAL_INICIAL = {
  nombre: '',
  descripcion: '',
  unidad: 'ud',
  stock_actual: '0',
  precio_ref: '',
  activo: true,
};

const OPCIONES_ITEMS_PAGINA = [5, 10, 20];

export function InventarioView({ rolUsuario }) {
  const [materialesInventario, setMaterialesInventario] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [materialForm, setMaterialForm] = useState(FORM_MATERIAL_INICIAL);
  const [materialEditandoId, setMaterialEditandoId] = useState('');
  const [paginaMateriales, setPaginaMateriales] = useState(1);
  const [itemsPaginaMateriales, setItemsPaginaMateriales] = useState(5);

  const sinConfiguracion = useMemo(() => !tieneConfiguracionSupabase(), []);
  const puedeEditarCatalogos = rolUsuario === 'admin' || rolUsuario === 'oficina';
  const modoSoloLectura = !puedeEditarCatalogos;

  const totalPaginasMateriales = Math.max(1, Math.ceil(materialesInventario.length / itemsPaginaMateriales));
  const materialesPaginados = useMemo(() => {
    const inicio = (paginaMateriales - 1) * itemsPaginaMateriales;
    return materialesInventario.slice(inicio, inicio + itemsPaginaMateriales);
  }, [materialesInventario, paginaMateriales, itemsPaginaMateriales]);

  useEffect(() => {
    if (paginaMateriales > totalPaginasMateriales) {
      setPaginaMateriales(totalPaginasMateriales);
    }
  }, [paginaMateriales, totalPaginasMateriales]);

  async function recargarDatos() {
    if (sinConfiguracion) {
      setCargando(false);
      return;
    }

    setCargando(true);
    setError('');

    try {
      const datosMateriales = await listarMaterialesInventario();
      setMaterialesInventario(datosMateriales || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los materiales de inventario.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargarDatos();
  }, []);

  function limpiarFormMaterial() {
    setMaterialForm(FORM_MATERIAL_INICIAL);
    setMaterialEditandoId('');
  }

  async function guardarMaterial(evento) {
    evento.preventDefault();
    setMensaje('');
    setError('');

    try {
      const payload = {
        nombre: materialForm.nombre,
        descripcion: materialForm.descripcion || null,
        unidad: materialForm.unidad || 'ud',
        stock_actual: materialForm.stock_actual,
        precio_ref: materialForm.precio_ref,
        activo: materialForm.activo,
      };

      if (materialEditandoId) {
        await actualizarMaterialInventario(materialEditandoId, payload);
        setMensaje('Material actualizado correctamente.');
      } else {
        await crearMaterialInventario(payload);
        setMensaje('Material creado correctamente.');
      }

      limpiarFormMaterial();
      await recargarDatos();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el material de inventario.');
    }
  }

  async function borrarMaterial(idMaterial) {
    setMensaje('');
    setError('');

    try {
      await eliminarMaterialInventario(idMaterial);
      setMensaje('Material eliminado correctamente.');
      if (materialEditandoId === idMaterial) {
        limpiarFormMaterial();
      }
      await recargarDatos();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el material de inventario.');
    }
  }

  if (sinConfiguracion) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        Configura Supabase en .env para habilitar el inventario de materiales.
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-20 lg:pb-0">
      <header className="rounded-2xl bg-marca-900 p-4 text-white shadow-lg lg:p-5">
        <h2 className="text-lg font-bold">Inventario SAT</h2>
        <p className="mt-1 text-sm text-slate-200">Gestión de materiales globales de almacén.</p>
      </header>

      {modoSoloLectura && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Tu rol técnico solo tiene acceso de consulta al inventario. La edición está reservada a administración/oficina.
        </p>
      )}

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {mensaje && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {mensaje}
        </p>
      )}

      <div className="lg:grid lg:grid-cols-12 lg:gap-4">
        {puedeEditarCatalogos && (
          <form onSubmit={guardarMaterial} className="space-y-3 rounded-2xl border border-marca-100 bg-white p-4 shadow-tarjeta lg:col-span-4 lg:sticky lg:top-5 lg:self-start">
            <h3 className="text-base font-bold text-slate-800">
              {materialEditandoId ? 'Editar material' : 'Nuevo material'}
            </h3>

            <input
              required
              value={materialForm.nombre}
              onChange={(e) => setMaterialForm((p) => ({ ...p, nombre: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Nombre del material"
            />

            <input
              value={materialForm.descripcion}
              onChange={(e) => setMaterialForm((p) => ({ ...p, descripcion: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Descripcion"
            />

            <div className="grid grid-cols-3 gap-2">
              <input
                value={materialForm.unidad}
                onChange={(e) => setMaterialForm((p) => ({ ...p, unidad: e.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Unidad"
              />
              <input
                type="number"
                min="0"
                value={materialForm.stock_actual}
                onChange={(e) => setMaterialForm((p) => ({ ...p, stock_actual: e.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Stock"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={materialForm.precio_ref}
                onChange={(e) => setMaterialForm((p) => ({ ...p, precio_ref: e.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Precio"
              />
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={materialForm.activo}
                onChange={(e) => setMaterialForm((p) => ({ ...p, activo: e.target.checked }))}
              />
              Material activo
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-xl bg-cotepa-rojo-500 px-4 py-3 text-sm font-bold text-white" type="submit">
                {materialEditandoId ? 'Actualizar' : 'Crear'}
              </button>
              <button
                className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
                type="button"
                onClick={limpiarFormMaterial}
              >
                Limpiar
              </button>
            </div>
          </form>
        )}

        <div className={`space-y-2 ${puedeEditarCatalogos ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          {cargando && <p className="text-sm font-semibold text-slate-600">Cargando materiales...</p>}
          {!cargando && materialesInventario.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-3">
                <span>Pagina {paginaMateriales} de {totalPaginasMateriales}</span>
                <label className="flex items-center gap-1">
                  <span>Mostrar</span>
                  <select
                    value={itemsPaginaMateriales}
                    onChange={(e) => {
                      setItemsPaginaMateriales(Number(e.target.value));
                      setPaginaMateriales(1);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                  >
                    {OPCIONES_ITEMS_PAGINA.map((opcion) => (
                      <option key={opcion} value={opcion}>{opcion}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaMateriales((previo) => Math.max(1, previo - 1))}
                  disabled={paginaMateriales === 1}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaMateriales((previo) => Math.min(totalPaginasMateriales, previo + 1))}
                  disabled={paginaMateriales === totalPaginasMateriales}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
          {!cargando &&
            materialesPaginados.map((material) => (
              <article key={material.id} className="rounded-2xl border border-marca-100 bg-white p-4 shadow-tarjeta">
                <p className="text-sm font-bold text-slate-800">{material.nombre}</p>
                <p className="text-xs text-slate-600">
                  {material.descripcion || 'Sin descripcion'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Stock: {material.stock_actual} {material.unidad || 'ud'} · Precio ref: {material.precio_ref ?? 'N/D'}
                </p>
                <p className="mt-1 text-xs text-slate-500">Estado: {material.activo ? 'Activo' : 'Inactivo'}</p>

                {puedeEditarCatalogos && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-marca-50 px-3 py-2 text-xs font-bold text-marca-700"
                      onClick={() => {
                        setMaterialEditandoId(material.id);
                        setMaterialForm({
                          nombre: material.nombre || '',
                          descripcion: material.descripcion || '',
                          unidad: material.unidad || 'ud',
                          stock_actual: String(material.stock_actual ?? 0),
                          precio_ref: material.precio_ref ?? '',
                          activo: Boolean(material.activo),
                        });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700"
                      onClick={() => borrarMaterial(material.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}
