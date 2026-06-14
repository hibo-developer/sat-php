import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useParteTrabajoMedia } from '../hooks/useParteTrabajoMedia';
import { useParteTrabajoMaterials } from '../hooks/useParteTrabajoMaterials';
import { useParteTrabajoState } from '../hooks/useParteTrabajoState';
import { useParteTrabajoSteps } from '../hooks/useParteTrabajoSteps';
import { useParteTrabajoSubmit } from '../hooks/useParteTrabajoSubmit';
import { useParteTrabajoTiming } from '../hooks/useParteTrabajoTiming';
import {
  obtenerClientes,
  obtenerEquiposPorCliente,
  obtenerTecnicosActivos,
} from '../services/catalogosService';
import { listarMaterialesInventario } from '../services/inventarioMaterialesService';
import { obtenerOrdenesAbiertasParaParte } from '../services/parteTrabajoService';
import {
  encolarPuntoGps,
  intentarActualizarOrden,
} from '../services/offlineSyncService';
import { tieneBackendApi } from '../services/backendClient';
import {
  construirUrlRutaCliente,
  formatearLugar,
  formatearUbicacion,
  geocodificarDireccion,
  normalizarDireccion,
  PASOS_PARTE,
  resolverEtiquetaCategoriaFoto,
} from '../services/parteTrabajoViewUtils';
import { deduplicarTecnicosParaSelector } from '../services/tecnicosUtils';

export function ParteTrabajoView() {
  const location = useLocation();
  const prefill = location.state?.prefill;
  const {
    prefillAplicadoRef,
    formulario,
    setFormulario,
    desplazamiento,
    setDesplazamiento,
    intervension,
    setIntervension,
    seguimientoTiempo,
    setSeguimientoTiempo,
    clientes,
    setClientes,
    equipos,
    setEquipos,
    ordenesAbiertas,
    setOrdenesAbiertas,
    tecnicos,
    setTecnicos,
    materialesInventario,
    setMaterialesInventario,
    materialSeleccionadoId,
    setMaterialSeleccionadoId,
    materialSeleccionadoCantidad,
    setMaterialSeleccionadoCantidad,
    materialesSeleccionados,
    setMaterialesSeleccionados,
    fotosIntervencion,
    setFotosIntervencion,
    previewsFotos,
    setPreviewsFotos,
    cargando,
    setCargando,
    guardando,
    setGuardando,
    capturandoTiempo,
    setCapturandoTiempo,
    capturandoDesplazamiento,
    setCapturandoDesplazamiento,
    capturandoIntervension,
    setCapturandoIntervension,
    capturandoPausaComida,
    setCapturandoPausaComida,
    pendienteGeoIntervension,
    setPendienteGeoIntervension,
    firmaClienteDataUrl,
    setFirmaClienteDataUrl,
    mensaje,
    setMensaje,
    error,
    setError,
    pasoActual,
    setPasoActual,
    canvasFirmaRef,
    inputFotoAntesRef,
    inputFotoDuranteRef,
    inputFotoDespuesRef,
    previewsFotosRef,
    dibujandoFirmaRef,
    ignorarGuardadoBorradorRef,
    llegadaRegistradaRef,
  } = useParteTrabajoState({ prefill });
  const {
    abrirCapturaFoto,
    iniciarTrazoFirma,
    limpiarFirma,
    manejarSeleccionFotos,
    quitarFotoIntervencion,
    terminarTrazoFirma,
    trazarFirma,
  } = useParteTrabajoMedia({
    canvasFirmaRef,
    dibujandoFirmaRef,
    fotosIntervencion,
    formulario,
    inputFotoAntesRef,
    inputFotoDuranteRef,
    inputFotoDespuesRef,
    numeroTicketPrefill: prefill?.numero_ticket || null,
    ordenesAbiertas,
    previewsFotosRef,
    setError,
    setFirmaClienteDataUrl,
    setFotosIntervencion,
    setMensaje,
    setPreviewsFotos,
  });
  const {
    agregarMaterialInventario,
    kmDesplazamiento,
    minutosDesplazamiento,
    minutosIntervensionBrutos,
    minutosIntervensionNetos,
    minutosPausaComida,
    puedeEliminarParteIncompletoSinOrden,
    puedeRegistrarParte,
    quitarMaterialInventario,
    totalMaterialesPreview,
  } = useParteTrabajoMaterials({
    cargando,
    desplazamiento,
    firmaClienteDataUrl,
    formulario,
    guardando,
    intervension,
    materialSeleccionadoCantidad,
    materialSeleccionadoId,
    materialesInventario,
    materialesSeleccionados,
    setError,
    setMaterialSeleccionadoCantidad,
    setMaterialesSeleccionados,
  });
  const {
    avanzarPaso,
    estadosPasos,
    fallarPaso,
    irAPaso,
    retrocederPaso,
    validarPaso,
  } = useParteTrabajoSteps({
    desplazamiento,
    firmaClienteDataUrl,
    formulario,
    intervension,
    pasoActual,
    setError,
    setPasoActual,
  });
  const {
    eliminarParteBorrador,
    enviarParte,
    resetearFormulario,
  } = useParteTrabajoSubmit({
    clientes,
    desplazamiento,
    equipos,
    fallarPaso,
    firmaClienteDataUrl,
    formulario,
    fotosIntervencion,
    ignorarGuardadoBorradorRef,
    intervension,
    limpiarFirma,
    materialesInventario,
    materialesSeleccionados,
    pasoActual,
    setDesplazamiento,
    setEquipos,
    setError,
    setFormulario,
    setFotosIntervencion,
    setGuardando,
    setIntervension,
    setMaterialSeleccionadoCantidad,
    setMaterialSeleccionadoId,
    setMaterialesSeleccionados,
    setMensaje,
    setOrdenesAbiertas,
    setPasoActual,
    setPendienteGeoIntervension,
    setSeguimientoTiempo,
    tecnicos,
    validarPaso,
    avanzarPaso,
  });
  const tecnicosUnicos = deduplicarTecnicosParaSelector(tecnicos, formulario.tecnico_id);
  const {
    iniciarSeguimientoTiempo,
    finalizarSeguimientoTiempo,
    iniciarDesplazamiento,
    finalizarDesplazamiento,
    iniciarIntervension,
    finalizarIntervension,
    iniciarPausaComida,
    finalizarPausaComida,
    eliminarPausaComida,
  } = useParteTrabajoTiming({
    desplazamiento,
    intervension,
    seguimientoTiempo,
    setCapturandoDesplazamiento,
    setCapturandoIntervension,
    setCapturandoPausaComida,
    setCapturandoTiempo,
    setDesplazamiento,
    setError,
    setFormulario,
    setIntervension,
    setMensaje,
    setPendienteGeoIntervension,
    setSeguimientoTiempo,
  });

  useEffect(() => {
    async function cargarCatalogos() {
      if (!tieneBackendApi()) {
        setCargando(false);
        return;
      }

      setCargando(true);
      setError('');

      try {
        const [clientesRsp, tecnicosRsp, materialesRsp] = await Promise.all([
          obtenerClientes({ limite: 100, pagina: 1 }),
          obtenerTecnicosActivos({ limite: 100, pagina: 1 }),
          listarMaterialesInventario({ soloActivos: true }),
        ]);

        setClientes(clientesRsp.items);
        setTecnicos(tecnicosRsp.items);
        setMaterialesInventario(materialesRsp || []);
      } catch (err) {
        setError(err.message || 'No se pudieron cargar los catálogos del parte de trabajo.');
      } finally {
        setCargando(false);
      }
    }

    cargarCatalogos();
  }, []);

  useEffect(() => {
    async function cargarEquipos() {
      if (!formulario.cliente_id || !tieneBackendApi()) {
        setEquipos([]);
        setFormulario((prev) => ({ ...prev, equipo_id: '' }));
        return;
      }

      try {
        const equiposRsp = await obtenerEquiposPorCliente(formulario.cliente_id, {
          limite: 100,
          pagina: 1,
        });
        setEquipos(equiposRsp.items);
      } catch (err) {
        setError(err.message || 'No se pudieron cargar los equipos del cliente.');
      }
    }

    cargarEquipos();
  }, [formulario.cliente_id]);

  useEffect(() => {
    async function cargarOrdenesAbiertas() {
      if (!formulario.cliente_id || !formulario.tecnico_id || !tieneBackendApi()) {
        setOrdenesAbiertas([]);
        setFormulario((prev) => ({ ...prev, orden_id: '' }));
        return;
      }

      try {
        const ordenes = await obtenerOrdenesAbiertasParaParte({
          cliente_id: formulario.cliente_id,
          tecnico_id: formulario.tecnico_id,
        });
        setOrdenesAbiertas(ordenes);
        setFormulario((prev) => {
          if (prev.orden_id && ordenes.some((orden) => orden.id === prev.orden_id)) {
            return prev;
          }

          return { ...prev, orden_id: '' };
        });
      } catch (err) {
        setError(err.message || 'No se pudieron cargar las ordenes abiertas para el parte.');
      }
    }

    cargarOrdenesAbiertas();
  }, [formulario.cliente_id, formulario.tecnico_id]);

  useEffect(() => {
    const prefill = location.state?.prefill;
    if (!prefill || prefillAplicadoRef.current) {
      return;
    }

    prefillAplicadoRef.current = true;
    setMensaje(
      prefill.numero_ticket
        ? `Orden SAT-${prefill.numero_ticket} cargada en el parte.`
        : 'Orden cargada en el parte.',
    );
  }, [location.state]);

    useEffect(() => {
      if (!pendienteGeoIntervension) {
        return;
      }

      let cancelado = false;

      async function registrarGeoInicioPendiente() {
        if (!navigator.onLine) {
          return;
        }

        try {
          const ubicacion = await obtenerUbicacionActual();
          const lugarResuelto = await resolverNombreLugar(ubicacion.latitud, ubicacion.longitud);

          if (cancelado) {
            return;
          }

          let actualizada = false;
          setIntervension((prev) => {
            if (!prev.inicioIso || prev.finIso || prev.ubicacionInicio) {
              return prev;
            }

            actualizada = true;
            return {
              ...prev,
              ubicacionInicio: {
                ...ubicacion,
                nombreLugar: lugarResuelto?.nombreLugar || null,
                nombreLugarCompleto: lugarResuelto?.nombreLugarCompleto || null,
              },
            };
          });

          if (actualizada) {
            setPendienteGeoIntervension(false);
            setMensaje('Conexión recuperada: geolocalización de inicio de intervención registrada.');
            setError('');
          }
        } catch {
          // Reintentaremos en el siguiente evento "online" mientras siga activa.
        }
      }

      function alVolverOnline() {
        void registrarGeoInicioPendiente();
      }

      window.addEventListener('online', alVolverOnline);
      void registrarGeoInicioPendiente();

      return () => {
        cancelado = true;
        window.removeEventListener('online', alVolverOnline);
      };
    }, [pendienteGeoIntervension]);

  useEffect(() => {
    if (!seguimientoTiempo.inicioIso || seguimientoTiempo.finIso) {
      return undefined;
    }
    if (!formulario.orden_id || !formulario.tecnico_id) {
      return undefined;
    }

    let cancelado = false;

    async function capturarPunto() {
      try {
        const ubicacion = await obtenerUbicacionActual();
        if (cancelado) return;
        await encolarPuntoGps({
          orden_id: formulario.orden_id,
          tecnico_id: formulario.tecnico_id,
          lat: ubicacion.latitud,
          lng: ubicacion.longitud,
          accuracy_m: ubicacion.precisionMetros,
          recorded_at: new Date().toISOString(),
          tipo: 'tracking',
          source: 'seguimiento',
        });
      } catch {}
    }

    void capturarPunto();
    const intervalo = window.setInterval(capturarPunto, 5 * 60 * 1000);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
    };
  }, [formulario.orden_id, formulario.tecnico_id, seguimientoTiempo.finIso, seguimientoTiempo.inicioIso]);

  useEffect(() => {
    const desplazamientoActivo = Boolean(desplazamiento.inicioIso && !desplazamiento.finIso);
    if (!desplazamientoActivo) {
      return undefined;
    }

    const cliente = clientes.find((c) => c.id === formulario.cliente_id);
    const lat = Number(cliente?.lat);
    const lng = Number(cliente?.lng);
    if (!navigator.geolocation || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return undefined;
    }

    llegadaRegistradaRef.current = false;
    let watchId = null;

    watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        if (llegadaRegistradaRef.current) return;
        const ubicacionActual = {
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
        };
        const objetivo = { latitud: lat, longitud: lng };
        const distancia = calcularDistanciaMetros(ubicacionActual, objetivo);
        if (distancia > 100) return;

        llegadaRegistradaRef.current = true;
        setMensaje('Llegada al cliente detectada (≤100m). Puedes iniciar la intervención.');
        setError('');

        try {
          await encolarPuntoGps({
            orden_id: formulario.orden_id,
            tecnico_id: formulario.tecnico_id,
            lat: ubicacionActual.latitud,
            lng: ubicacionActual.longitud,
            accuracy_m: pos.coords.accuracy,
            recorded_at: new Date().toISOString(),
            tipo: 'arrival',
            source: 'arrival',
          });
        } catch {}

        if (formulario.orden_id && formulario.tecnico_id) {
          intentarActualizarOrden(formulario.orden_id, {
            tecnico_id: formulario.tecnico_id,
            prioridad: formulario.prioridad || 'media',
            estado: 'en_proceso',
          }).catch(() => { /* noop */ });
        }

        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [clientes, desplazamiento.finIso, desplazamiento.inicioIso, formulario.cliente_id, formulario.orden_id, formulario.prioridad, formulario.tecnico_id]);

  async function abrirRutaCliente() {
    let ventanaRuta = null;

    try {
      const cliente = clientes.find((c) => String(c.id) === String(formulario.cliente_id));
      const direccion = normalizarDireccion(cliente?.direccion);
      let lat = cliente?.lat ?? null;
      let lng = cliente?.lng ?? null;
      const latNumInicial = Number(lat);
      const lngNumInicial = Number(lng);
      const tieneCoordsInicial =
        Number.isFinite(latNumInicial) &&
        Number.isFinite(lngNumInicial) &&
        !(latNumInicial === 0 && lngNumInicial === 0);

      if (!tieneCoordsInicial && direccion) {
        ventanaRuta = window.open('', '_blank');
        setError('');
        setMensaje('Buscando dirección del cliente…');
        const coords = await geocodificarDireccion(direccion);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        } else {
          lat = null;
          lng = null;
        }
      }

      const url = construirUrlRutaCliente({
        lat,
        lng,
        direccion,
        modoNavegacion: true,
      });

      if (!url) {
        if (ventanaRuta && !ventanaRuta.closed) {
          ventanaRuta.close();
        }
        setError('El cliente no tiene coordenadas ni dirección para abrir la ruta.');
        return;
      }

      setError('');
      setMensaje('');

      if (ventanaRuta && !ventanaRuta.closed) {
        try {
          ventanaRuta.location.replace(url);
          return;
        } catch {
          ventanaRuta.close();
        }
      }

      const nuevaVentana = window.open(url, '_blank', 'noopener,noreferrer');
      if (!nuevaVentana) {
        window.location.assign(url);
      }
    } catch {
      if (ventanaRuta && !ventanaRuta.closed) {
        ventanaRuta.close();
      }
      setMensaje('');
      setError('No se pudo abrir la ruta del cliente.');
    }
  }

  const panelFotosIntervencion = pasoActual >= 1 ? (
    <div className="rounded-xl border border-slate-300 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Fotos de la intervención</span>
        {fotosIntervencion.length > 0 && (
          <button
            type="button"
            onClick={() => setFotosIntervencion([])}
            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
          >
            Quitar todos
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => abrirCapturaFoto('antes')}
          disabled={guardando}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
        >
          Añadir (antes)
        </button>
        <button
          type="button"
          onClick={() => abrirCapturaFoto('durante')}
          disabled={guardando}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
        >
          Añadir (durante)
        </button>
        <button
          type="button"
          onClick={() => abrirCapturaFoto('despues')}
          disabled={guardando}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
        >
          Añadir (después)
        </button>
      </div>
      <input
        ref={inputFotoAntesRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => manejarSeleccionFotos(e, 'antes')}
        className="hidden"
      />
      <input
        ref={inputFotoDuranteRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => manejarSeleccionFotos(e, 'durante')}
        className="hidden"
      />
      <input
        ref={inputFotoDespuesRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => manejarSeleccionFotos(e, 'despues')}
        className="hidden"
      />
      <p className="mt-2 text-[11px] text-slate-600">
        Puedes capturar evidencias antes, durante y después de la intervención. Para varias fotos, repite la captura por etapa.
      </p>
      {fotosIntervencion.length > 0 && (
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {fotosIntervencion.map((foto, indice) => (
            <li key={`${foto.name}-${foto.size}-${foto.lastModified}`} className="rounded-lg bg-slate-50 p-2 text-xs">
              <img
                src={previewsFotosRef.current.get(`${foto.name}-${foto.size}-${foto.lastModified}`)}
                alt={foto.name}
                className="h-20 w-full rounded-md object-cover"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-700">{foto.name}</p>
                  <p className="text-[11px] text-slate-500">{resolverEtiquetaCategoriaFoto(foto.name)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => quitarFotoIntervencion(indice)}
                  className="shrink-0 rounded-lg bg-rose-100 px-2 py-1 font-semibold text-rose-700"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

  if (!tieneBackendApi()) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        Configura la API del backend para usar el formulario de parte de trabajo.
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-20 lg:pb-0">
      <header className="rounded-2xl bg-marca-900 p-4 text-white shadow-lg lg:p-5">
        <h2 className="text-lg font-bold lg:text-xl">Parte de Trabajo</h2>
        <p className="mt-1 text-sm text-slate-200">Registro técnico para cierre operativo de averías.</p>
      </header>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {mensaje && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {mensaje}
        </p>
      )}

      <form onSubmit={enviarParte} className="space-y-4 rounded-2xl border border-marca-100 bg-white p-4 shadow-tarjeta lg:p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-marca-900">Detalle del parte</h2>
          <p className="text-xs text-slate-600">
            El parte puede vincularse a una orden abierta o registrarse como imprevisto sin orden previa.
          </p>
          <p className="text-xs text-slate-500">
            Al guardarlo, la orden vinculada se finaliza. Si no hay orden, se crea una orden imprevista y se finaliza en el mismo paso.
          </p>
        </div>

        <div className="grid gap-2 lg:grid-cols-4">
          {estadosPasos.map((paso, indice) => (
            <button
              key={paso.id}
              type="button"
              onClick={() => irAPaso(indice)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                paso.activo
                  ? 'border-cotepa-rojo-500 bg-red-50'
                  : paso.completado
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Paso {indice + 1}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  paso.completado ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500'
                }`}>
                  {paso.completado ? 'OK' : paso.activo ? 'Actual' : 'Pendiente'}
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-marca-900">{paso.titulo}</p>
              <p className="mt-1 text-xs text-slate-600">{paso.descripcion}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {PASOS_PARTE[pasoActual].titulo}
            </p>
            <p className="mt-1 text-sm text-slate-600">{PASOS_PARTE[pasoActual].descripcion}</p>
          </div>

          {pasoActual === 0 && (
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Cliente *</span>
                <select
                  value={formulario.cliente_id}
                  onChange={(e) => {
                    const clienteId = e.target.value;
                    const cliente = clientes.find((item) => item.id === clienteId);
                    setFormulario((prev) => ({
                      ...prev,
                      cliente_id: clienteId,
                      cliente_nombre: cliente?.nombre || prev.cliente_nombre,
                      equipo_id: '',
                      orden_id: '',
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  disabled={cargando}
                >
                  <option value="">Selecciona cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formulario.cliente_nombre}
                  onChange={(e) =>
                    setFormulario((prev) => ({
                      ...prev,
                      cliente_nombre: e.target.value,
                      orden_id: '',
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="Si no existe, escribe el nombre del cliente"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Equipo</span>
                <select
                  value={formulario.equipo_id}
                  onChange={(e) => {
                    const equipoId = e.target.value;
                    const equipo = equipos.find((item) => item.id === equipoId);
                    setFormulario((prev) => ({
                      ...prev,
                      equipo_id: equipoId,
                      equipo_nombre: equipo?.nombre || prev.equipo_nombre,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  disabled={!formulario.cliente_id}
                >
                  <option value="">Sin equipo</option>
                  {equipos.map((equipo) => (
                    <option key={equipo.id} value={equipo.id}>
                      {equipo.nombre}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formulario.equipo_nombre}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, equipo_nombre: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="Opcional: nombre del equipo para usar/crear"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Técnico *</span>
                <select
                  required
                  value={formulario.tecnico_id}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, tecnico_id: e.target.value, orden_id: '' }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="">Selecciona técnico</option>
                  {tecnicosUnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>
                      {tecnico.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Orden abierta (opcional)</span>
                <select
                  value={formulario.orden_id}
                  onChange={(e) => {
                    const ordenId = e.target.value;
                    const orden = ordenesAbiertas.find((item) => item.id === ordenId);
                    setFormulario((prev) => ({
                      ...prev,
                      orden_id: ordenId,
                      equipo_id: orden?.equipo_id || prev.equipo_id,
                      descripcion_problema: orden?.descripcion_averia || prev.descripcion_problema,
                      prioridad: orden?.prioridad || prev.prioridad,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  disabled={!formulario.cliente_id || !formulario.tecnico_id}
                >
                  <option value="">Sin orden previa (imprevista)</option>
                  {ordenesAbiertas.map((orden) => (
                    <option key={orden.id} value={orden.id}>
                      #{orden.numero_ticket} · {orden.descripcion_averia}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Si no seleccionas orden, el sistema creará una orden imprevista y la cerrará con este parte.
                </p>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Prioridad</span>
                <select
                  value={formulario.prioridad}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, prioridad: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>

              <label className="block lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Descripción del problema *</span>
                <textarea
                  required
                  rows={4}
                  value={formulario.descripcion_problema}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, descripcion_problema: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="Describe la avería reportada"
                />
              </label>
            </div>
          )}

          {pasoActual === 1 && (
            <div className="space-y-4">
              {formulario.cliente_id && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs font-semibold text-sky-900">Ruta al cliente</p>
                  <button
                    type="button"
                    onClick={abrirRutaCliente}
                    disabled={guardando}
                    className="mt-2 w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 disabled:opacity-60"
                  >
                    Iniciar ruta al cliente
                  </button>
                  <p className="mt-2 text-[11px] text-slate-600">
                    Usa coordenadas si están guardadas; si no, usa la dirección del cliente.
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-xs font-semibold text-cyan-900">Desplazamiento</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={iniciarDesplazamiento}
                    disabled={capturandoDesplazamiento || guardando || desplazamiento.inicioIso}
                    className="rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-800 disabled:opacity-60"
                  >
                    Inicio Desplazamiento
                  </button>
                  <button
                    type="button"
                    onClick={finalizarDesplazamiento}
                    disabled={capturandoDesplazamiento || guardando || !desplazamiento.inicioIso || desplazamiento.finIso}
                    className="rounded-xl border border-cyan-400 bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 disabled:opacity-60"
                  >
                    Fin Desplazamiento
                  </button>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-slate-700 lg:grid-cols-2">
                  <p>Inicio: {desplazamiento.inicioIso ? new Date(desplazamiento.inicioIso).toLocaleString('es-ES') : 'No iniciado'}</p>
                  <p>Fin: {desplazamiento.finIso ? new Date(desplazamiento.finIso).toLocaleString('es-ES') : 'No finalizado'}</p>
                  <p>Origen: {formatearLugar(desplazamiento.ubicacionInicio)}</p>
                  <p>Destino: {formatearLugar(desplazamiento.ubicacionFin)}</p>
                  <p>Distancia: {kmDesplazamiento ? `${kmDesplazamiento} km` : 'Pendiente'}</p>
                  <p>Tiempo desplazamiento: {Number.isFinite(minutosDesplazamiento) ? `${minutosDesplazamiento} min` : 'Pendiente'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-marca-200 bg-marca-50 p-3">
                <p className="text-xs font-semibold text-marca-900">Intervención (en cliente por geolocalización)</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={iniciarIntervension}
                    disabled={capturandoIntervension || guardando || intervension.inicioIso}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                  >
                    Inicio Intervención
                  </button>
                  <button
                    type="button"
                    onClick={finalizarIntervension}
                    disabled={capturandoIntervension || guardando || !intervension.inicioIso || intervension.finIso}
                    className="rounded-xl border border-emerald-400 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-60"
                  >
                    Fin Intervención
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={iniciarPausaComida}
                    disabled={capturandoPausaComida || guardando || !intervension.inicioIso || Boolean(intervension.finIso) || Boolean(intervension.pausaComidaActiva?.inicioIso)}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-60"
                  >
                    Inicio Pausa Comida
                  </button>
                  <button
                    type="button"
                    onClick={finalizarPausaComida}
                    disabled={capturandoPausaComida || guardando || !intervension.pausaComidaActiva?.inicioIso}
                    className="rounded-xl border border-amber-400 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60"
                  >
                    Fin Pausa Comida
                  </button>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-slate-700 lg:grid-cols-2">
                  <p>Inicio: {intervension.inicioIso ? new Date(intervension.inicioIso).toLocaleString('es-ES') : 'No iniciado'}</p>
                  <p>Fin: {intervension.finIso ? new Date(intervension.finIso).toLocaleString('es-ES') : 'No finalizado'}</p>
                  <p>Ubicación cliente: {formatearLugar(intervension.ubicacionInicio)}</p>
                  <p>Pausa activa: {intervension.pausaComidaActiva?.inicioIso ? new Date(intervension.pausaComidaActiva.inicioIso).toLocaleString('es-ES') : 'No'}</p>
                  <p>Tiempo bruto: {Number.isFinite(minutosIntervensionBrutos) ? `${minutosIntervensionBrutos} min` : 'Pendiente'}</p>
                  <p>Tiempo neto: {Number.isFinite(minutosIntervensionNetos) ? `${minutosIntervensionNetos} min` : (Number.isFinite(intervension.minutosGeo) ? `${intervension.minutosGeo} min` : 'Pendiente')}</p>
                  <p className="lg:col-span-2">Pausas comida: {intervension.pausasComida.length} ({minutosPausaComida} min)</p>
                </div>
                {pendienteGeoIntervension && !intervension.finIso && !intervension.ubicacionInicio && (
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    Sin conexión: se usa el reloj del sistema. La geolocalización se registrará al volver internet.
                  </p>
                )}
                {intervension.pausasComida.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {intervension.pausasComida.map((pausa, indice) => (
                      <li key={`${pausa.inicioIso || 'pausa'}-${indice}`} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <span>
                          #{indice + 1} · {new Date(pausa.inicioIso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {new Date(pausa.finIso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {pausa.minutos} min
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarPausaComida(indice)}
                          disabled={guardando || Boolean(intervension.pausaComidaActiva?.inicioIso)}
                          className="rounded-lg bg-rose-100 px-2 py-1 font-semibold text-rose-700 disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {panelFotosIntervencion}

          {pasoActual === 2 && (
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
              <label className="block lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Tareas realizadas</span>
                <textarea
                  rows={4}
                  value={formulario.tareas_realizadas_libre}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, tareas_realizadas_libre: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="Describe el trabajo realizado (diagnóstico, acciones, sustituciones, pruebas, etc.)"
                />
              </label>

              <label className="block lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Materiales utilizados</span>
                <textarea
                  rows={4}
                  value={formulario.materialesTexto}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, materialesTexto: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder={"Ejemplo:\nGas R32;1;45.5\nFiltro;2;12"}
                />
              </label>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 lg:col-span-2">
                <p className="text-xs font-semibold text-slate-700">Materiales desde inventario (descuenta stock)</p>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <select
                      value={materialSeleccionadoId}
                      onChange={(e) => setMaterialSeleccionadoId(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Selecciona material</option>
                      {materialesInventario.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.nombre} · stock {material.stock_actual}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={materialSeleccionadoCantidad}
                      onChange={(e) => setMaterialSeleccionadoCantidad(e.target.value)}
                      className="w-16 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={agregarMaterialInventario}
                    className="w-full rounded-xl bg-marca-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    Agregar
                  </button>
                </div>

                {materialesSeleccionados.length > 0 && (
                  <ul className="space-y-1">
                    {materialesSeleccionados.map((uso) => {
                      const material = materialesInventario.find((item) => item.id === uso.material_id);
                      return (
                        <li key={uso.material_id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                          <span>
                            {material?.nombre || 'Material'} · {uso.cantidad} {material?.unidad || 'ud'}
                          </span>
                          <button
                            type="button"
                            onClick={() => quitarMaterialInventario(uso.material_id)}
                            className="rounded-lg bg-rose-100 px-2 py-1 font-semibold text-rose-700"
                          >
                            Quitar
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  Total materiales (previo): {totalMaterialesPreview.toFixed(2)} EUR
                </p>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Tiempo empleado (min) *</span>
                <input
                  required
                  min="1"
                  type="number"
                  value={formulario.tiempo_empleado}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, tiempo_empleado: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Mecánicos en la intervención</span>
                <input
                  min="1"
                  type="number"
                  value={formulario.mecanicos_intervinieron}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, mecanicos_intervinieron: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </label>

            </div>
          )}

          {pasoActual === 3 && (
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
              <div className="rounded-xl border border-slate-300 bg-white p-3 lg:col-span-2">
                <p className="text-xs font-semibold text-slate-700">Informe PDF</p>
                <p className="mt-2 text-xs text-slate-600">
                  Al guardar, el parte queda registrado y el administrador podrá generar el informe PDF definitivo desde el panel SAT tras completar la valoración económica.
                </p>
              </div>

              <div className="rounded-xl border border-slate-300 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">Checklist final</p>
                <ul className="mt-2 space-y-2 text-xs text-slate-700">
                  <li>Contexto: {validarPaso(0, { mostrarError: false }) ? 'completo' : 'pendiente'}</li>
                  <li>Tiempos: {validarPaso(1, { mostrarError: false }) ? 'completo' : 'pendiente'}</li>
                  <li>Ejecución: {validarPaso(2, { mostrarError: false }) ? 'completo' : 'pendiente'}</li>
                  <li>Firma: {validarPaso(3, { mostrarError: false }) ? 'completa' : 'pendiente'}</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-300 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">Resumen rápido</p>
                <ul className="mt-2 space-y-2 text-xs text-slate-700">
                  <li>Cliente: {formulario.cliente_nombre || clientes.find((c) => c.id === formulario.cliente_id)?.nombre || 'Pendiente'}</li>
                  <li>Técnico: {tecnicos.find((t) => t.id === formulario.tecnico_id)?.nombre || 'Pendiente'}</li>
                  <li>Tiempo neto: {Number.isFinite(minutosIntervensionNetos) ? `${minutosIntervensionNetos} min` : formulario.tiempo_empleado ? `${formulario.tiempo_empleado} min` : 'Pendiente'}</li>
                  <li>Fotos: {fotosIntervencion.length}</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-300 bg-white p-3 lg:col-span-2">
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">Nombre de quien firma *</span>
                  <input
                    required
                    type="text"
                    value={formulario.nombre_firmante}
                    onChange={(e) => setFormulario((prev) => ({ ...prev, nombre_firmante: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Nombre y apellidos"
                    maxLength={120}
                  />
                </label>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Firma del cliente *</span>
                  <button
                    type="button"
                    onClick={limpiarFirma}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    Limpiar firma
                  </button>
                </div>
                <canvas
                  ref={canvasFirmaRef}
                  width={320}
                  height={140}
                  onPointerDown={iniciarTrazoFirma}
                  onPointerMove={trazarFirma}
                  onPointerUp={terminarTrazoFirma}
                  onPointerLeave={terminarTrazoFirma}
                  className="w-full rounded-lg border border-slate-300 bg-white"
                  style={{ touchAction: 'none' }}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Firma requerida para completar el parte.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={retrocederPaso}
              disabled={pasoActual === 0}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              Anterior
            </button>
            {puedeEliminarParteIncompletoSinOrden && pasoActual === PASOS_PARTE.length - 1 && (
              <button
                type="button"
                disabled={guardando || cargando}
                onClick={eliminarParteBorrador}
                className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-60"
              >
                Eliminar parte
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Paso {pasoActual + 1} de {PASOS_PARTE.length}
            </span>
            {pasoActual < PASOS_PARTE.length - 1 ? (
              <button
                type="button"
                onClick={avanzarPaso}
                className="rounded-2xl bg-marca-900 px-4 py-3 text-sm font-bold text-white"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={!puedeRegistrarParte}
                className="rounded-2xl bg-cotepa-rojo-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {guardando ? 'Guardando parte...' : 'Registrar parte de trabajo'}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
