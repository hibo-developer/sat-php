import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CircleCheckBig, Clock3, Download, Hammer, TriangleAlert, Wrench } from 'lucide-react';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { ToastEstado } from '../components/ToastEstado';
import { useOrdenes } from '../hooks/useOrdenes';
import { useDebounce } from '../hooks/useDebounce';
import {
  obtenerClientes,
  obtenerEquiposPorCliente,
  obtenerTecnicosActivos,
} from '../services/catalogosService';
import { tieneConfiguracionSupabase } from '../services/supabaseClient';

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

const FILTROS_ESTADO = ['Todas', 'Pendiente', 'En Proceso', 'Pausado', 'Finalizado'];
const BLOQUE_ORDENES_LISTADO = 20;
const OPCIONES_ESTADO_EDITABLE = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'pausado', label: 'Pausado' },
];

function columnaExcel(indice) {
  let n = indice;
  let resultado = '';

  while (n > 0) {
    const resto = (n - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    n = Math.floor((n - 1) / 26);
  }

  return resultado;
}

async function descargarExcelProfesional({
  nombreArchivo,
  hojaNombre,
  titulo,
  subtitulo,
  columnas,
  filas,
  resumen = [],
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SAT COTEPA';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(hojaNombre);
  const totalColumnas = columnas.length;
  const ultimaColumna = columnaExcel(totalColumnas);

  columnas.forEach((columna, indice) => {
    worksheet.getColumn(indice + 1).width = columna.width || 20;
  });

  worksheet.mergeCells(`A1:${ultimaColumna}1`);
  worksheet.getCell('A1').value = titulo;
  worksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(`A2:${ultimaColumna}2`);
  worksheet.getCell('A2').value = subtitulo;
  worksheet.getCell('A2').font = { italic: true, size: 11, color: { argb: 'FF334155' } };
  worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 20;

  let filaActual = 4;
  if (resumen.length) {
    worksheet.getCell(`A${filaActual}`).value = 'Resumen';
    worksheet.getCell(`A${filaActual}`).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
    filaActual += 1;

    resumen.forEach(([etiqueta, valor]) => {
      worksheet.getCell(`A${filaActual}`).value = etiqueta;
      worksheet.getCell(`A${filaActual}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
      worksheet.getCell(`B${filaActual}`).value = valor;
      worksheet.getCell(`B${filaActual}`).font = { size: 10, color: { argb: 'FF334155' } };
      filaActual += 1;
    });

    filaActual += 1;
  }

  const filaEncabezado = filaActual;
  columnas.forEach((columna, indice) => {
    const celda = worksheet.getCell(filaEncabezado, indice + 1);
    celda.value = columna.header;
    celda.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    celda.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    celda.alignment = { vertical: 'middle', horizontal: 'left' };
    celda.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const filaDatosInicio = filaEncabezado + 1;
  const filasDatos = filas.length ? filas : [{ __sinDatos: 'Sin datos para los filtros actuales' }];

  filasDatos.forEach((fila, indiceFila) => {
    const numeroFila = filaDatosInicio + indiceFila;

    columnas.forEach((columna, indiceColumna) => {
      const celda = worksheet.getCell(numeroFila, indiceColumna + 1);
      celda.value = fila[columna.key] ?? '';
      celda.font = { size: 10, color: { argb: 'FF0F172A' } };
      celda.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: indiceFila % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' },
      };
      celda.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (columna.numFmt) {
        celda.numFmt = columna.numFmt;
      }
    });
  });

  const filaDatosFin = filaDatosInicio + filasDatos.length - 1;
  worksheet.autoFilter = {
    from: { row: filaEncabezado, column: 1 },
    to: { row: filaEncabezado, column: totalColumnas },
  };

  worksheet.views = [{ state: 'frozen', ySplit: filaEncabezado }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);

  return { filaDatosInicio, filaDatosFin };
}

function FormularioNuevaOrden({ onCrear, accionEnCurso, onNotificar, puedeCrearOrdenes }) {
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
  const formularioDeshabilitado = !puedeCrearOrdenes || !tieneConfiguracionSupabase() || cargandoCatalogos;

  useEffect(() => {
    async function cargarClientes() {
      if (!tieneConfiguracionSupabase()) {
        setMensaje('Configura Supabase para habilitar el alta de órdenes con catálogos reales.');
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
      } catch {
        setMensaje('No se pudieron cargar los clientes.');
      } finally {
        setCargandoClientes(false);
      }
    }

    cargarClientes();
  }, [busquedaClienteDebounce, paginaClientes]);

  useEffect(() => {
    async function cargarTecnicos() {
      if (!tieneConfiguracionSupabase()) {
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
      } catch {
        setMensaje('No se pudieron cargar los técnicos.');
      } finally {
        setCargandoTecnicos(false);
      }
    }

    cargarTecnicos();
  }, [busquedaTecnicoDebounce, paginaTecnicos]);

  useEffect(() => {
    async function cargarEquipos() {
      if (!formulario.cliente_id || !tieneConfiguracionSupabase()) {
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
      } catch {
        setEquipos([]);
        setMensaje('No se pudieron cargar los equipos del cliente seleccionado.');
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

function TarjetaOrden({
  orden,
  tecnicosActivos,
  accionEnCurso,
  onFinalizar,
  onActualizar,
  onNotificar,
  puedeEditarOrden,
}) {
  const { icono: IconoEstado, clase } = estilosEstado[orden.estado] || estilosEstado.Pendiente;
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [mostrarEdicion, setMostrarEdicion] = useState(false);
  const [tareasRealizadas, setTareasRealizadas] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [tiempoEmpleadoMinutos, setTiempoEmpleadoMinutos] = useState('60');
  const [mensajeEdicion, setMensajeEdicion] = useState('');
  const [formularioEdicion, setFormularioEdicion] = useState({
    tecnico_id: orden.tecnicoId || '',
    prioridad: orden.prioridad || 'media',
    estado: orden.estado === 'En Proceso' ? 'en_proceso' : orden.estado === 'Pausado' ? 'pausado' : 'pendiente',
  });

  useEffect(() => {
    setFormularioEdicion({
      tecnico_id: orden.tecnicoId || '',
      prioridad: orden.prioridad || 'media',
      estado: orden.estado === 'En Proceso' ? 'en_proceso' : orden.estado === 'Pausado' ? 'pausado' : 'pendiente',
    });
  }, [orden.estado, orden.prioridad, orden.tecnicoId]);

  async function enviarCierre(evento) {
    evento.preventDefault();
    try {
      await onFinalizar(orden.id, { tareasRealizadas, fotoUrl, tiempoEmpleadoMinutos });
      setMostrarCierre(false);
      setTareasRealizadas('');
      setFotoUrl('');
      setTiempoEmpleadoMinutos('60');
      onNotificar({
        tipo: 'exito',
        titulo: 'Orden finalizada',
        descripcion: `La orden de ${orden.equipo} se ha cerrado correctamente.`,
      });
    } catch (err) {
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo finalizar la orden',
        descripcion: err.message || 'Revisa los datos de cierre e inténtalo de nuevo.',
      });
    }
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    setMensajeEdicion('');

    try {
      await onActualizar(orden.id, formularioEdicion);
      setMostrarEdicion(false);
      setMensajeEdicion('Orden actualizada correctamente.');
      onNotificar({
        tipo: 'exito',
        titulo: 'Orden actualizada',
        descripcion: 'Se han guardado el técnico, el estado y la prioridad.',
      });
    } catch (err) {
      setMensajeEdicion(err.message || 'No se pudo actualizar la orden.');
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo actualizar la orden',
        descripcion: err.message || 'Revisa los cambios y vuelve a intentarlo.',
      });
    }
  }

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
        <p>
          <span className="font-semibold text-slate-900">Avería:</span> {orden.descripcion}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-marca-50 px-3 py-2 text-xs font-semibold text-marca-700">
        <span>Prioridad: {orden.prioridad}</span>
        <span>{orden.fecha}</span>
      </div>

      {orden.estado === 'Finalizado' && (
        <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {orden.informePdfUrl && (
            <a
              href={orden.informePdfUrl}
              download={`informe-${orden.numero_ticket || orden.id}.pdf`}
              className="inline-flex rounded-lg bg-marca-900 px-3 py-2 text-xs font-bold text-white"
            >
              Descargar informe PDF
            </a>
          )}
          {!orden.informePdfUrl && (
            <p className="text-xs font-semibold text-emerald-800">Informe PDF no disponible.</p>
          )}
        </div>
      )}

      {orden.estado !== 'Finalizado' && (
        <div className="mt-3 space-y-2">
          <div className={`grid gap-2 ${puedeEditarOrden ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {puedeEditarOrden && (
              <button
                type="button"
                onClick={() => {
                  setMostrarEdicion((previo) => !previo);
                  setMensajeEdicion('');
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 active:scale-95"
              >
                {mostrarEdicion ? 'Cancelar edición' : 'Editar orden'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMostrarCierre((previo) => !previo)}
              className="w-full rounded-xl bg-cotepa-rojo-500 px-4 py-3 text-sm font-bold text-white active:scale-95"
            >
              {mostrarCierre ? 'Cancelar cierre' : 'Finalizar Orden'}
            </button>
          </div>

          {mostrarEdicion && puedeEditarOrden && (
            <form onSubmit={guardarEdicion} className="space-y-2 rounded-xl border border-marca-100 bg-marca-50 p-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Técnico *</span>
                <select
                  required
                  value={formularioEdicion.tecnico_id}
                  onChange={(evento) =>
                    setFormularioEdicion((previo) => ({ ...previo, tecnico_id: evento.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Selecciona técnico</option>
                  {tecnicosActivos.map((tecnico) => (
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
                  onChange={(evento) =>
                    setFormularioEdicion((previo) => ({ ...previo, estado: evento.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {OPCIONES_ESTADO_EDITABLE.map((opcion) => (
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
                  onChange={(evento) =>
                    setFormularioEdicion((previo) => ({ ...previo, prioridad: evento.target.value }))
                  }
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
          )}

          {mostrarCierre && (
            <form onSubmit={enviarCierre} className="space-y-2 rounded-xl border border-marca-100 bg-marca-50 p-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Tareas realizadas *</span>
                <textarea
                  required
                  rows={3}
                  value={tareasRealizadas}
                  onChange={(evento) => setTareasRealizadas(evento.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ej: limpieza de filtros y cambio de válvula"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">URL de foto</span>
                <input
                  value={fotoUrl}
                  onChange={(evento) => setFotoUrl(evento.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Tiempo empleado (min) *</span>
                <input
                  required
                  min="1"
                  type="number"
                  value={tiempoEmpleadoMinutos}
                  onChange={(evento) => setTiempoEmpleadoMinutos(evento.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={accionEnCurso}
                className="w-full rounded-xl bg-marca-900 px-4 py-3 text-sm font-bold text-white active:scale-95 disabled:opacity-60"
              >
                {accionEnCurso ? 'Cerrando...' : 'Confirmar Finalización'}
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export function ListaOrdenesView({ rolUsuario }) {
  const [tecnicosActivos, setTecnicosActivos] = useState([]);
  const [toast, setToast] = useState(null);
  const [exportandoZip, setExportandoZip] = useState(false);
  const [filtroClienteAnalisis, setFiltroClienteAnalisis] = useState('todos');
  const [busquedaOrdenes, setBusquedaOrdenes] = useState('');
  const [cantidadOrdenesVisibles, setCantidadOrdenesVisibles] = useState(BLOQUE_ORDENES_LISTADO);
  const busquedaOrdenesDebounce = useDebounce(busquedaOrdenes, 200);
  const {
    ordenes,
    ordenesFiltradas,
    cargando,
    error,
    accionEnCurso,
    filtroEstado,
    setFiltroEstado,
    crearOrdenDesdeFormulario,
    finalizarOrden,
    actualizarOrden,
  } = useOrdenes();

  useEffect(() => {
    async function cargarTecnicosEdicion() {
      if (!tieneConfiguracionSupabase()) {
        setTecnicosActivos([]);
        return;
      }

      try {
        const respuesta = await obtenerTecnicosActivos({ limite: 100, pagina: 1 });
        setTecnicosActivos(respuesta.items);
      } catch {
        setTecnicosActivos([]);
      }
    }

    cargarTecnicosEdicion();
  }, []);

  function notificar(siguienteToast) {
    setToast({
      id: Date.now(),
      ...siguienteToast,
    });
  }

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
  }, [clientesAnalisis, filtroClienteAnalisis]);

  useEffect(() => {
    setCantidadOrdenesVisibles(BLOQUE_ORDENES_LISTADO);
  }, [filtroEstado, ordenes.length, busquedaOrdenesDebounce]);

  const ordenesAnalisis = filtroClienteAnalisis === 'todos'
    ? ordenesFiltradas
    : ordenesFiltradas.filter((orden) => orden.clienteId === filtroClienteAnalisis);

  const resumenAnalisis = ordenesAnalisis.reduce(
    (acc, orden) => {
      acc[orden.estado] = (acc[orden.estado] || 0) + 1;
      return acc;
    },
    { Pendiente: 0, 'En Proceso': 0, Pausado: 0, Finalizado: 0 },
  );

  const ordenesFinalizadas = ordenesAnalisis.filter((orden) => orden.estado === 'Finalizado');
  const informesDisponibles = ordenesFinalizadas.filter((orden) => orden.informePdfUrl).length;
  const terminoBusqueda = busquedaOrdenesDebounce.trim().toLowerCase();
  const ordenesListado = terminoBusqueda
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
    : ordenesFiltradas;
  const totalOrdenesFiltradas = ordenesListado.length;
  const ordenesPaginadas = ordenesListado.slice(0, cantidadOrdenesVisibles);
  const hayMasOrdenes = totalOrdenesFiltradas > cantidadOrdenesVisibles;
  const esTecnico = rolUsuario === 'tecnico';
  const puedeCrearOrdenes = rolUsuario !== 'tecnico';
  const puedeEditarOrden = rolUsuario !== 'tecnico';
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

  async function exportarOrdenesExcel() {
    try {
      const filas = ordenesAnalisis.map((orden) => ({
        ticket: orden.numero_ticket || '',
        cliente: orden.cliente,
        equipo: orden.equipo,
        tecnico: orden.tecnico,
        estado: orden.estado,
        prioridad: orden.prioridad,
        tiempo_min: Number(orden.tiempoEmpleadoMinutos || 0),
        coste_materiales: Number(orden.costeMateriales || 0),
        fecha_inicio: orden.fechaInicioIso ? new Date(orden.fechaInicioIso).toLocaleString('es-ES') : '',
        fecha_fin: orden.fechaFinIso ? new Date(orden.fechaFinIso).toLocaleString('es-ES') : '',
        informe_pdf: orden.informePdfUrl || '',
      }));

      await descargarExcelProfesional({
        nombreArchivo: `ordenes-sat-${new Date().toISOString().slice(0, 10)}.xlsx`,
        hojaNombre: 'Ordenes SAT',
        titulo: 'SAT COTEPA · Exportación profesional de órdenes',
        subtitulo: `Generado el ${new Date().toLocaleString('es-ES')} · Cliente: ${filtroClienteAnalisis === 'todos' ? 'Todos' : (clientesAnalisis.find((c) => c.id === filtroClienteAnalisis)?.nombre || 'Filtrado')}`,
        columnas: [
          { key: 'ticket', header: 'Ticket', width: 14 },
          { key: 'cliente', header: 'Cliente', width: 28 },
          { key: 'equipo', header: 'Equipo', width: 24 },
          { key: 'tecnico', header: 'Técnico', width: 24 },
          { key: 'estado', header: 'Estado', width: 16 },
          { key: 'prioridad', header: 'Prioridad', width: 14 },
          { key: 'tiempo_min', header: 'Tiempo (min)', width: 14, numFmt: '0' },
          { key: 'coste_materiales', header: 'Coste materiales (€)', width: 20, numFmt: '#,##0.00' },
          { key: 'fecha_inicio', header: 'Fecha inicio', width: 22 },
          { key: 'fecha_fin', header: 'Fecha fin', width: 22 },
          { key: 'informe_pdf', header: 'URL informe PDF', width: 38 },
        ],
        filas,
        resumen: [
          ['Órdenes en análisis', ordenesAnalisis.length],
          ['Órdenes finalizadas', ordenesFinalizadas.length],
          ['MTTR (min)', mttrMinutos],
          ['Coste materiales total (€)', Number(costeTotalMateriales)],
        ],
      });

      notificar({
        tipo: 'exito',
        titulo: 'Excel generado',
        descripcion: 'Se descargó un archivo .xlsx con formato profesional.',
      });
    } catch (err) {
      notificar({
        tipo: 'error',
        titulo: 'No se pudo exportar órdenes',
        descripcion: err.message || 'No se pudo generar el archivo Excel de órdenes.',
      });
    }
  }

  async function exportarKpisExcel() {
    try {
      const filas = [
        { kpi: 'Total órdenes', valor: ordenesAnalisis.length },
        { kpi: 'Órdenes finalizadas', valor: ordenesFinalizadas.length },
        { kpi: 'MTTR (min)', valor: mttrMinutos },
        { kpi: 'SLA <=48h (%)', valor: cumplimientoSla48h },
        { kpi: 'First Time Fix proxy (%)', valor: firstTimeFixProxy },
        { kpi: 'Coste materiales total (€)', valor: Number(costeTotalMateriales) },
      ];

      await descargarExcelProfesional({
        nombreArchivo: `kpi-sat-${new Date().toISOString().slice(0, 10)}.xlsx`,
        hojaNombre: 'KPIs SAT',
        titulo: 'SAT COTEPA · Informe KPI profesional',
        subtitulo: `Generado el ${new Date().toLocaleString('es-ES')} · Cliente: ${filtroClienteAnalisis === 'todos' ? 'Todos' : (clientesAnalisis.find((c) => c.id === filtroClienteAnalisis)?.nombre || 'Filtrado')}`,
        columnas: [
          { key: 'kpi', header: 'Indicador', width: 36 },
          { key: 'valor', header: 'Valor', width: 20 },
        ],
        filas,
      });

      notificar({
        tipo: 'exito',
        titulo: 'KPI Excel generado',
        descripcion: 'Se descargó un KPI en formato .xlsx con diseño profesional.',
      });
    } catch (err) {
      notificar({
        tipo: 'error',
        titulo: 'No se pudo exportar KPI',
        descripcion: err.message || 'No se pudo generar el archivo Excel de KPI.',
      });
    }
  }

  async function exportarInformesZip() {
    const informes = ordenesFinalizadas.filter((orden) => orden.informePdfUrl);

    if (!informes.length) {
      notificar({
        tipo: 'error',
        titulo: 'Sin informes disponibles',
        descripcion: 'No hay órdenes finalizadas con informe PDF para exportar.',
      });
      return;
    }

    setExportandoZip(true);

    try {
      const zip = new JSZip();
      let agregados = 0;

      for (const orden of informes) {
        try {
          const respuesta = await fetch(orden.informePdfUrl);
          if (!respuesta.ok) {
            continue;
          }

          const blob = await respuesta.blob();
          const nombre = `informe-${orden.numero_ticket || orden.id}.pdf`;
          zip.file(nombre, blob);
          agregados += 1;
        } catch {
          // Ignorar informes individuales con fallo y continuar con el resto.
        }
      }

      if (!agregados) {
        throw new Error('No se pudo descargar ningún informe PDF.');
      }

      const contenidoZip = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(contenidoZip);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `informes-sat-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);

      notificar({
        tipo: 'exito',
        titulo: 'ZIP generado',
        descripcion: `Se descargaron ${agregados} informes en un archivo ZIP.`,
      });
    } catch (err) {
      notificar({
        tipo: 'error',
        titulo: 'No se pudo generar el ZIP',
        descripcion: err.message || 'Revisa conexión y permisos de acceso a informes.',
      });
    } finally {
      setExportandoZip(false);
    }
  }

  if (cargando) {
    return <p className="text-sm font-semibold text-slate-600">Cargando órdenes...</p>;
  }

  return (
    <section className="space-y-4 lg:space-y-5">
      <ToastEstado toast={toast} onClose={() => setToast(null)} />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <header className="rounded-2xl bg-marca-900 p-4 text-white shadow-lg lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Órdenes de Trabajo</h2>
            <p className="mt-1 text-sm text-slate-200">
              Consulta, crea y actualiza el estado de cada avería desde el móvil.
            </p>
          </div>
        </div>

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
              onClick={exportarInformesZip}
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
              <p className="mt-2 text-xl font-extrabold text-white">{ordenesFinalizadas.length}</p>
              <p className="text-xs text-slate-200">órdenes finalizadas analizadas</p>
              <button
                type="button"
                onClick={exportarKpisExcel}
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
            <p className="mt-2 text-xl font-extrabold text-white">{ordenes.length}</p>
            <p className="text-xs text-slate-200">registros totales exportables</p>
            <button
              type="button"
              onClick={exportarOrdenesExcel}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-marca-900"
            >
              Descargar Excel de órdenes
            </button>
          </article>
        </div>

        <div className="mt-3 rounded-xl border border-white/15 bg-white/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Ámbito de análisis</p>
            <span className="text-[11px] font-semibold text-slate-300">{ordenesAnalisis.length} órdenes en análisis</span>
          </div>
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-semibold text-slate-200">Filtrar por cliente</span>
            <select
              value={filtroClienteAnalisis}
              onChange={(evento) => setFiltroClienteAnalisis(evento.target.value)}
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
              onClick={() => setFiltroEstado(filtro)}
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
              onChange={(evento) => setBusquedaOrdenes(evento.target.value)}
              className="w-full rounded-lg border border-white/20 bg-marca-900 px-3 py-2 text-sm text-white placeholder:text-slate-300"
              placeholder="Ticket, cliente, equipo o técnico"
            />
          </label>
        </div>
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
          {ordenesPaginadas.map((orden) => (
            <TarjetaOrden
              key={orden.id}
              orden={orden}
              tecnicosActivos={tecnicosActivos}
              accionEnCurso={accionEnCurso}
              onFinalizar={finalizarOrden}
              onActualizar={actualizarOrden}
              onNotificar={notificar}
              puedeEditarOrden={puedeEditarOrden}
            />
          ))}

          {totalOrdenesFiltradas > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  Mostrando {Math.min(cantidadOrdenesVisibles, totalOrdenesFiltradas)} de {totalOrdenesFiltradas} órdenes.
                </p>
                {hayMasOrdenes && (
                  <button
                    type="button"
                    onClick={() => setCantidadOrdenesVisibles((previo) => previo + BLOQUE_ORDENES_LISTADO)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    Cargar más órdenes
                  </button>
                )}
              </div>
            </div>
          )}

          {!ordenesListado.length && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-medium text-slate-600">
              <TriangleAlert className="h-4 w-4" />
              No hay órdenes disponibles con los filtros y búsqueda seleccionados.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
