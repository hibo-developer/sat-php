import {
  calcularDistanciaCarreteraMetros,
  calcularDistanciaMetros,
  calcularMinutosPausasComida,
  obtenerUbicacionActual,
  redondearMinutos,
  resolverNombreLugar,
  UBICACION_COTEPA,
} from '../services/parteTrabajoViewUtils';

export function useParteTrabajoTiming({
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
}) {
  async function iniciarSeguimientoTiempo() {
    setMensaje('');
    setError('');
    setCapturandoTiempo(true);

    try {
      const ubicacion = await obtenerUbicacionActual();
      const lugarResuelto = await resolverNombreLugar(ubicacion.latitud, ubicacion.longitud);
      setSeguimientoTiempo({
        inicioIso: new Date().toISOString(),
        finIso: null,
        ubicacionInicio: {
          ...ubicacion,
          nombreLugar: lugarResuelto?.nombreLugar || null,
          nombreLugarCompleto: lugarResuelto?.nombreLugarCompleto || null,
        },
        ubicacionFin: null,
        distanciaMetros: null,
        minutosGeo: null,
      });
      setMensaje('Inicio registrado con geolocalización.');
    } catch {
      const inicioIso = new Date().toISOString();
      setSeguimientoTiempo({
        inicioIso,
        finIso: null,
        ubicacionInicio: null,
        ubicacionFin: null,
        distanciaMetros: null,
        minutosGeo: null,
      });
      setFormulario((prev) => ({ ...prev, tiempo_empleado: '1' }));
      setMensaje('Inicio registrado con hora actual (sin geolocalización).');
      setError('');
    } finally {
      setCapturandoTiempo(false);
    }
  }

  async function finalizarSeguimientoTiempo() {
    if (!seguimientoTiempo.inicioIso) {
      setError('Primero debes pulsar Inicio para calcular el tiempo empleado.');
      return;
    }

    setMensaje('');
    setError('');
    setCapturandoTiempo(true);

    try {
      const ubicacionFin = await obtenerUbicacionActual();
      const lugarFinResuelto = await resolverNombreLugar(ubicacionFin.latitud, ubicacionFin.longitud);
      const finIso = new Date().toISOString();
      const minutosCalculados = redondearMinutos(seguimientoTiempo.inicioIso, finIso);
      const ubicacionFinConLugar = {
        ...ubicacionFin,
        nombreLugar: lugarFinResuelto?.nombreLugar || null,
        nombreLugarCompleto: lugarFinResuelto?.nombreLugarCompleto || null,
      };
      const distanciaMetros = calcularDistanciaMetros(seguimientoTiempo.ubicacionInicio, ubicacionFinConLugar);
      const minutosGeo = seguimientoTiempo.ubicacionInicio?.timestamp
        ? redondearMinutos(
          new Date(seguimientoTiempo.ubicacionInicio.timestamp).toISOString(),
          new Date(ubicacionFin.timestamp).toISOString(),
        )
        : minutosCalculados;

      setSeguimientoTiempo((prev) => ({
        ...prev,
        finIso,
        ubicacionFin: ubicacionFinConLugar,
        distanciaMetros,
        minutosGeo,
      }));
      setFormulario((prev) => ({ ...prev, tiempo_empleado: String(minutosCalculados) }));
      setMensaje('Fin registrado. Tiempo empleado calculado automáticamente.');
    } catch {
      const finIso = new Date().toISOString();
      const minutosCalculados = redondearMinutos(seguimientoTiempo.inicioIso, finIso);

      setSeguimientoTiempo((prev) => ({
        ...prev,
        finIso,
        ubicacionFin: null,
        distanciaMetros: null,
        minutosGeo: minutosCalculados,
      }));
      setFormulario((prev) => ({ ...prev, tiempo_empleado: String(minutosCalculados) }));
      setMensaje('Fin registrado con hora actual (sin geolocalización). Tiempo empleado calculado automáticamente.');
      setError('');
    } finally {
      setCapturandoTiempo(false);
    }
  }

  async function iniciarDesplazamiento() {
    setMensaje('');
    setError('');
    setCapturandoDesplazamiento(true);

    try {
      setDesplazamiento({
        inicioIso: new Date().toISOString(),
        finIso: null,
        ubicacionInicio: UBICACION_COTEPA,
        ubicacionFin: null,
        distanciaMetros: null,
        minutosGeo: null,
      });
      setMensaje('Desplazamiento iniciado (origen fijo: Cotepa S.L., Paiporta).');
    } finally {
      setCapturandoDesplazamiento(false);
    }
  }

  async function finalizarDesplazamiento() {
    if (!desplazamiento.inicioIso) {
      setError('Primero debes pulsar Inicio Desplazamiento.');
      return;
    }

    if (desplazamiento.finIso || intervension.inicioIso) {
      return;
    }

    setMensaje('');
    setError('');
    setCapturandoDesplazamiento(true);

    try {
      const ubicacionCliente = await obtenerUbicacionActual();
      const lugarResuelto = await resolverNombreLugar(ubicacionCliente.latitud, ubicacionCliente.longitud);
      const finIso = new Date().toISOString();
      const distanciaMetros = await calcularDistanciaCarreteraMetros(UBICACION_COTEPA, ubicacionCliente);

      setDesplazamiento({
        inicioIso: desplazamiento.inicioIso,
        finIso,
        ubicacionInicio: UBICACION_COTEPA,
        ubicacionFin: {
          ...ubicacionCliente,
          nombreLugar: lugarResuelto?.nombreLugar || null,
          nombreLugarCompleto: lugarResuelto?.nombreLugarCompleto || null,
        },
        distanciaMetros,
        minutosGeo: null,
      });
      setMensaje('Desplazamiento finalizado. Distancia calculada (se facturará el doble: ida+vuelta).');
    } catch {
      const finIso = new Date().toISOString();

      setDesplazamiento((prev) => ({
        ...prev,
        finIso,
        minutosGeo: null,
      }));
      setError('No se pudo capturar ubicación del cliente.');
    } finally {
      setCapturandoDesplazamiento(false);
    }
  }

  async function iniciarIntervension() {
    setMensaje('');
    setError('');
    setCapturandoIntervension(true);

    const inicioIntervIso = new Date().toISOString();

    try {
      const ubicacion = await obtenerUbicacionActual();
      const lugarResuelto = await resolverNombreLugar(ubicacion.latitud, ubicacion.longitud);
      const ubicacionConLugar = {
        ...ubicacion,
        nombreLugar: lugarResuelto?.nombreLugar || null,
        nombreLugarCompleto: lugarResuelto?.nombreLugarCompleto || null,
      };

      if (!desplazamiento.inicioIso) {
        setDesplazamiento({
          inicioIso: inicioIntervIso,
          finIso: null,
          ubicacionInicio: UBICACION_COTEPA,
          ubicacionFin: null,
          distanciaMetros: null,
          minutosGeo: null,
        });
      }

      if (!desplazamiento.finIso) {
        const distanciaDesplazamiento = await calcularDistanciaCarreteraMetros(UBICACION_COTEPA, ubicacionConLugar);
        setDesplazamiento((prev) => ({
          ...prev,
          inicioIso: prev?.inicioIso || inicioIntervIso,
          finIso: inicioIntervIso,
          ubicacionInicio: prev.ubicacionInicio || UBICACION_COTEPA,
          ubicacionFin: ubicacionConLugar,
          distanciaMetros: distanciaDesplazamiento,
          minutosGeo: null,
        }));
      }

      setIntervension({
        inicioIso: inicioIntervIso,
        finIso: null,
        ubicacionInicio: ubicacionConLugar,
        ubicacionFin: null,
        distanciaMetros: null,
        minutosGeo: null,
        pausasComida: [],
        pausaComidaActiva: null,
      });
      setPendienteGeoIntervension(false);
      setMensaje('Intervención iniciada con geolocalización en cliente.');
    } catch {
      const sinConexion = navigator.onLine === false;

      if (!desplazamiento.finIso) {
        setDesplazamiento((prev) => ({
          ...prev,
          inicioIso: prev?.inicioIso || inicioIntervIso,
          finIso: inicioIntervIso,
          minutosGeo: null,
        }));
      }

      setIntervension({
        inicioIso: inicioIntervIso,
        finIso: null,
        ubicacionInicio: null,
        ubicacionFin: null,
        distanciaMetros: null,
        minutosGeo: null,
        pausasComida: [],
        pausaComidaActiva: null,
      });
      setPendienteGeoIntervension(sinConexion);
      setMensaje(
        sinConexion
          ? 'Intervención iniciada con hora del sistema (sin conexión). Se registrará la geolocalización al recuperar internet.'
          : 'Intervención iniciada (sin geolocalización).',
      );
      setError('');
    } finally {
      setCapturandoIntervension(false);
    }
  }

  async function finalizarIntervension() {
    if (!intervension.inicioIso) {
      setError('Primero debes pulsar Inicio Intervención.');
      return;
    }

    if (intervension.pausaComidaActiva?.inicioIso) {
      setError('Debes cerrar la pausa de comida activa antes de finalizar la intervención.');
      return;
    }

    setMensaje('');
    setError('');
    setCapturandoIntervension(true);

    try {
      const ubicacionFin = await obtenerUbicacionActual();
      const lugarFinResuelto = await resolverNombreLugar(ubicacionFin.latitud, ubicacionFin.longitud);
      const finIso = new Date().toISOString();
      const minutosCalculados = redondearMinutos(intervension.inicioIso, finIso);
      const minutosPausaComida = calcularMinutosPausasComida(intervension.pausasComida);
      const minutosNetos = Math.max(1, minutosCalculados - minutosPausaComida);
      const ubicacionFinConLugar = {
        ...ubicacionFin,
        nombreLugar: lugarFinResuelto?.nombreLugar || null,
        nombreLugarCompleto: lugarFinResuelto?.nombreLugarCompleto || null,
      };
      const distanciaMetros = calcularDistanciaMetros(intervension.ubicacionInicio, ubicacionFinConLugar);

      setIntervension((prev) => ({
        ...prev,
        finIso,
        ubicacionFin: ubicacionFinConLugar,
        distanciaMetros,
        minutosGeo: minutosNetos,
      }));
      setPendienteGeoIntervension(false);
      setFormulario((prev) => ({ ...prev, tiempo_empleado: String(minutosNetos) }));
      setMensaje('Intervención finalizada. Tiempo neto calculado descontando pausas de comida.');
    } catch {
      const finIso = new Date().toISOString();
      const minutosCalculados = redondearMinutos(intervension.inicioIso, finIso);
      const minutosPausaComida = calcularMinutosPausasComida(intervension.pausasComida);
      const minutosNetos = Math.max(1, minutosCalculados - minutosPausaComida);

      setIntervension((prev) => ({
        ...prev,
        finIso,
        minutosGeo: minutosNetos,
      }));
      setPendienteGeoIntervension(false);
      setFormulario((prev) => ({ ...prev, tiempo_empleado: String(minutosNetos) }));
      setError('No se pudo capturar ubicación final.');
    } finally {
      setCapturandoIntervension(false);
    }
  }

  function iniciarPausaComida() {
    if (!intervension.inicioIso || intervension.finIso) {
      setError('La pausa de comida solo puede iniciarse durante una intervención activa.');
      return;
    }

    if (intervension.pausaComidaActiva?.inicioIso) {
      setError('Ya hay una pausa de comida activa.');
      return;
    }

    setError('');
    setMensaje('');
    setCapturandoPausaComida(true);

    setIntervension((prev) => ({
      ...prev,
      pausaComidaActiva: {
        inicioIso: new Date().toISOString(),
      },
    }));

    setMensaje('Pausa de comida iniciada.');
    setCapturandoPausaComida(false);
  }

  function finalizarPausaComida() {
    if (!intervension.pausaComidaActiva?.inicioIso) {
      setError('No hay una pausa de comida activa para finalizar.');
      return;
    }

    const finIso = new Date().toISOString();
    const inicioIso = intervension.pausaComidaActiva.inicioIso;
    const minutos = redondearMinutos(inicioIso, finIso);

    setError('');
    setMensaje('');
    setCapturandoPausaComida(true);

    setIntervension((prev) => ({
      ...prev,
      pausasComida: [...(prev.pausasComida || []), { inicioIso, finIso, minutos }],
      pausaComidaActiva: null,
    }));

    setMensaje('Pausa de comida finalizada y registrada.');
    setCapturandoPausaComida(false);
  }

  function eliminarPausaComida(indiceObjetivo) {
    if (!Number.isInteger(indiceObjetivo) || indiceObjetivo < 0) {
      return;
    }

    setError('');
    setMensaje('');

    setIntervension((prev) => {
      const pausasActuales = Array.isArray(prev.pausasComida) ? prev.pausasComida : [];
      const pausasActualizadas = pausasActuales.filter((_, indice) => indice !== indiceObjetivo);

      if (prev.inicioIso && prev.finIso) {
        const minutosBrutos = redondearMinutos(prev.inicioIso, prev.finIso);
        const minutosPausa = calcularMinutosPausasComida(pausasActualizadas);
        const minutosNetos = Math.max(1, minutosBrutos - minutosPausa);
        setFormulario((actual) => ({ ...actual, tiempo_empleado: String(minutosNetos) }));

        return {
          ...prev,
          pausasComida: pausasActualizadas,
          minutosGeo: minutosNetos,
        };
      }

      return {
        ...prev,
        pausasComida: pausasActualizadas,
      };
    });

    setMensaje('Pausa de comida eliminada.');
  }

  return {
    finalizarDesplazamiento,
    finalizarIntervension,
    finalizarPausaComida,
    finalizarSeguimientoTiempo,
    iniciarDesplazamiento,
    iniciarIntervension,
    iniciarPausaComida,
    iniciarSeguimientoTiempo,
    eliminarPausaComida,
  };
}
