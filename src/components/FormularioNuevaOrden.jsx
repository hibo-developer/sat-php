import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import {
  obtenerClientes,
  obtenerEquiposPorCliente,
  obtenerTecnicosActivos,
} from '../services/catalogosService';
import { tieneBackendApi } from '../services/backendClient';

export function FormularioNuevaOrden({ onCrear, accionEnCurso, onNotificar, puedeCrearOrdenes }) {
  const LIMITE_CATALOGO = 20;
  const [clientes, setClientes] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [cargandoEquipos, setCargandoEquipos] = useState(false);
  const [cargandoTecnicos, setCargandoTecnicos] = useState(false);
  const [hayMasClientes, setHayMasClientes] = useState(false);
  const [hayMasEquipos, setHayMasEquipos] = useState(false);
  const [hayMasTecnicos, setHayMasTecnicos] = useState(false);
  const [paginaClientes, setPaginaClientes] = useState(1);
  const [paginaEquipos, setPaginaEquipos] = useState(1);
  const [paginaTecnicos, setPaginaTecnicos] = useState(1);
  const [formulario, setFormulario] = useState({
    cliente_id: '',
    equipo_id: '',
    tecnico_id: '',
    descripcion_averia: '',
    prioridad: 'media',
  });

  const [mensaje, setMensaje] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaEquipo, setBusquedaEquipo] = useState('');
  const [busquedaTecnico, setBusquedaTecnico] = useState('');

  const busquedaClienteDebounce = useDebounce(busquedaCliente, 250);
  const busquedaEquipoDebounce = useDebounce(busquedaEquipo, 250);
  const busquedaTecnicoDebounce = useDebounce(busquedaTecnico, 250);
  const cargandoCatalogos = cargandoClientes || cargandoEquipos || cargandoTecnicos;
  const formularioDeshabilitado = !puedeCrearOrdenes || !tieneBackendApi() || cargandoCatalogos;

  useEffect(() => {
    async function cargarClientes() {
      if (!tieneBackendApi()) {
        setMensaje('Configura la API del backend para habilitar el alta de órdenes con catálogos reales.');
        return;
      }

      setCargandoClientes(true);

      try {
        const respuesta = await obtenerClientes({
          busqueda: busquedaClienteDebounce,
          limite: LIMITE_CATALOGO,
          pagina: paginaClientes,
        });

        setClientes((previo) => (paginaClientes === 1 ? respuesta.items : [...previo, ...respuesta.items]));
        setHayMasClientes(respuesta.hayMas);
      } catch (err) {
        setMensaje(err.message || 'No se pudieron cargar los clientes.');
      } finally {
        setCargandoClientes(false);
      }
    }

    cargarClientes();
  }, [busquedaClienteDebounce, paginaClientes]);

  useEffect(() => {
    async function cargarTecnicos() {
      if (!tieneBackendApi()) {
        return;
      }

      setCargandoTecnicos(true);

      try {
        const respuesta = await obtenerTecnicosActivos({
          busqueda: busquedaTecnicoDebounce,
          limite: LIMITE_CATALOGO,
          pagina: paginaTecnicos,
        });

        setTecnicos((previo) => (paginaTecnicos === 1 ? respuesta.items : [...previo, ...respuesta.items]));
        setHayMasTecnicos(respuesta.hayMas);
      } catch (err) {
        setMensaje(err.message || 'No se pudieron cargar los técnicos.');
      } finally {
        setCargandoTecnicos(false);
      }
    }

    cargarTecnicos();
  }, [busquedaTecnicoDebounce, paginaTecnicos]);

  useEffect(() => {
    async function cargarEquipos() {
      if (!formulario.cliente_id || !tieneBackendApi()) {
        setEquipos([]);
        setHayMasEquipos(false);
        setBusquedaEquipo('');
        setFormulario((previo) => ({ ...previo, equipo_id: '' }));
        return;
      }

      setCargandoEquipos(true);

      try {
        const respuesta = await obtenerEquiposPorCliente(formulario.cliente_id, {
          busqueda: busquedaEquipoDebounce,
          limite: LIMITE_CATALOGO,
          pagina: paginaEquipos,
        });

        setEquipos((previo) => (paginaEquipos === 1 ? respuesta.items : [...previo, ...respuesta.items]));
        setHayMasEquipos(respuesta.hayMas);
      } catch (err) {
        setEquipos([]);
        setMensaje(err.message || 'No se pudieron cargar los equipos del cliente seleccionado.');
      } finally {
        setCargandoEquipos(false);
      }
    }

    cargarEquipos();
  }, [formulario.cliente_id, busquedaEquipoDebounce, paginaEquipos]);

  function actualizarCampo(evento) {
    const { name, value } = evento.target;
    setFormulario((previo) => ({ ...previo, [name]: value }));
  }

  async function enviarFormulario(evento) {
    evento.preventDefault();
    setMensaje('');

    try {
      await onCrear({
        ...formulario,
        equipo_id: formulario.equipo_id || null,
        tecnico_id: formulario.tecnico_id || null,
      });

      setFormulario({
        cliente_id: '',
        equipo_id: '',
        tecnico_id: '',
        descripcion_averia: '',
        prioridad: 'media',
      });
      setBusquedaCliente('');
      setBusquedaEquipo('');
      setBusquedaTecnico('');
      setPaginaClientes(1);
      setPaginaEquipos(1);
      setPaginaTecnicos(1);
      setMensaje('Orden creada correctamente.');
      onNotificar({
        tipo: 'exito',
        titulo: 'Orden creada',
        descripcion: 'La orden se ha registrado y ya aparece en la lista.',
      });
    } catch (err) {
      setMensaje(err.message || 'No se pudo crear la orden. Revisa los datos obligatorios y vuelve a intentarlo.');
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo crear la orden',
        descripcion: err.message || 'Revisa los datos obligatorios y vuelve a intentarlo.',
      });
    }
  }

  return (
    <form
      onSubmit={enviarFormulario}
      className="space-y-3 rounded-2xl border border-marca-100 bg-white p-4 shadow-tarjeta"
    >
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5 text-marca-700" />
        <h3 className="text-base font-bold text-slate-800">Nueva Orden de Trabajo</h3>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Cliente *</span>
        <input
          value={busquedaCliente}
          onChange={(evento) => {
            setPaginaClientes(1);
            setBusquedaCliente(evento.target.value);
          }}
          className="mb-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          placeholder="Buscar cliente por nombre"
          disabled={formularioDeshabilitado}
        />
        <select
          required
          name="cliente_id"
          value={formulario.cliente_id}
          onChange={(evento) => {
            const clienteSeleccionado = clientes.find((cliente) => cliente.id === evento.target.value);
            setFormulario((previo) => ({
              ...previo,
              cliente_id: evento.target.value,
              equipo_id: '',
            }));
            setPaginaEquipos(1);
            setEquipos([]);
            setBusquedaEquipo('');
            if (clienteSeleccionado) {
              setBusquedaCliente(clienteSeleccionado.nombre);
            }
          }}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          disabled={formularioDeshabilitado}
        >
          <option value="">Selecciona cliente</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre}
            </option>
          ))}
        </select>
        {!!busquedaClienteDebounce && clientes.length === 0 && (
          <p className="mt-1 text-xs font-medium text-slate-500">No hay clientes que coincidan con la búsqueda.</p>
        )}
        {hayMasClientes && (
          <button
            type="button"
            onClick={() => setPaginaClientes((previo) => previo + 1)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
            disabled={cargandoClientes}
          >
            {cargandoClientes ? 'Cargando...' : 'Cargar más clientes'}
          </button>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Equipo</span>
        <input
          value={busquedaEquipo}
          onChange={(evento) => {
            setPaginaEquipos(1);
            setBusquedaEquipo(evento.target.value);
          }}
          className="mb-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          placeholder="Buscar equipo por nombre, marca o modelo"
          disabled={!formulario.cliente_id || formularioDeshabilitado}
        />
        <select
          name="equipo_id"
          value={formulario.equipo_id}
          onChange={(evento) => {
            const equipoSeleccionado = equipos.find((equipo) => equipo.id === evento.target.value);
            setFormulario((previo) => ({ ...previo, equipo_id: evento.target.value }));
            if (equipoSeleccionado) {
              const etiqueta = [equipoSeleccionado.nombre, equipoSeleccionado.marca, equipoSeleccionado.modelo]
                .filter(Boolean)
                .join(' ');
              setBusquedaEquipo(etiqueta);
            }
          }}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          disabled={!formulario.cliente_id || formularioDeshabilitado}
        >
          <option value="">Sin equipo</option>
          {equipos.map((equipo) => (
            <option key={equipo.id} value={equipo.id}>
              {equipo.nombre}
              {equipo.marca ? ` - ${equipo.marca}` : ''}
              {equipo.modelo ? ` ${equipo.modelo}` : ''}
            </option>
          ))}
        </select>
        {!!busquedaEquipoDebounce && equipos.length === 0 && (
          <p className="mt-1 text-xs font-medium text-slate-500">No hay equipos que coincidan con la búsqueda.</p>
        )}
        {hayMasEquipos && (
          <button
            type="button"
            onClick={() => setPaginaEquipos((previo) => previo + 1)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
            disabled={cargandoEquipos}
          >
            {cargandoEquipos ? 'Cargando...' : 'Cargar más equipos'}
          </button>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Técnico *</span>
        <input
          value={busquedaTecnico}
          onChange={(evento) => {
            setPaginaTecnicos(1);
            setBusquedaTecnico(evento.target.value);
          }}
          className="mb-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          placeholder="Buscar técnico por nombre o especialidad"
          disabled={formularioDeshabilitado}
        />
        <select
          required
          name="tecnico_id"
          value={formulario.tecnico_id}
          onChange={(evento) => {
            const tecnicoSeleccionado = tecnicos.find((tecnico) => tecnico.id === evento.target.value);
            setFormulario((previo) => ({ ...previo, tecnico_id: evento.target.value }));
            if (tecnicoSeleccionado) {
              const etiqueta = [tecnicoSeleccionado.nombre, tecnicoSeleccionado.especialidad]
                .filter(Boolean)
                .join(' ');
              setBusquedaTecnico(etiqueta);
            }
          }}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          disabled={formularioDeshabilitado}
        >
          <option value="">Selecciona técnico</option>
          {tecnicos.map((tecnico) => (
            <option key={tecnico.id} value={tecnico.id}>
              {tecnico.nombre}
              {tecnico.especialidad ? ` (${tecnico.especialidad})` : ''}
            </option>
          ))}
        </select>
        {!!busquedaTecnicoDebounce && tecnicos.length === 0 && (
          <p className="mt-1 text-xs font-medium text-slate-500">No hay técnicos que coincidan con la búsqueda.</p>
        )}
        {hayMasTecnicos && (
          <button
            type="button"
            onClick={() => setPaginaTecnicos((previo) => previo + 1)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
            disabled={cargandoTecnicos}
          >
            {cargandoTecnicos ? 'Cargando...' : 'Cargar más técnicos'}
          </button>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Descripción de la avería *</span>
        <textarea
          required
          name="descripcion_averia"
          value={formulario.descripcion_averia}
          onChange={actualizarCampo}
          rows={3}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          placeholder="Describe el problema detectado"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">Prioridad</span>
        <select
          name="prioridad"
          value={formulario.prioridad}
          onChange={actualizarCampo}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
        >
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={accionEnCurso || formularioDeshabilitado}
        className="w-full rounded-2xl bg-cotepa-rojo-500 px-4 py-4 text-sm font-bold text-white active:scale-95 disabled:opacity-60"
      >
        {cargandoCatalogos
          ? 'Cargando catálogos...'
          : !puedeCrearOrdenes
            ? 'Sin permisos para crear órdenes'
            : accionEnCurso
              ? 'Guardando...'
              : 'Crear Orden'}
      </button>

      {mensaje && <p className="text-xs font-semibold text-slate-600">{mensaje}</p>}
      {!puedeCrearOrdenes && (
        <p className="text-xs font-semibold text-slate-600">
          Tu rol técnico no permite crear órdenes nuevas.
        </p>
      )}
    </form>
  );
}
