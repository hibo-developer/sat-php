import { useEffect, useRef, useState } from 'react';
import {
  DESPLAZAMIENTO_INICIAL,
  FORM_INICIAL,
  guardarBorradorParte,
  INTERVENSION_INICIAL,
  leerBorradorParte,
  SEGUIMIENTO_INICIAL,
} from '../services/parteTrabajoViewUtils';

export function useParteTrabajoState({ prefill }) {
  const prefillAplicadoRef = useRef(false);
  const borradorInicialRef = useRef();
  if (borradorInicialRef.current === undefined) {
    borradorInicialRef.current = prefill ? null : leerBorradorParte();
  }

  const [formulario, setFormulario] = useState(() => {
    if (prefill) {
      return {
        ...FORM_INICIAL,
        orden_id: prefill.orden_id || '',
        cliente_id: prefill.cliente_id || '',
        equipo_id: prefill.equipo_id || '',
        tecnico_id: prefill.tecnico_id || '',
        descripcion_problema: prefill.descripcion_problema || '',
        prioridad: prefill.prioridad || 'media',
      };
    }

    const formularioCacheado = borradorInicialRef.current?.formulario;
    if (!formularioCacheado || typeof formularioCacheado !== 'object') {
      return FORM_INICIAL;
    }

    return {
      ...FORM_INICIAL,
      ...formularioCacheado,
    };
  });

  const [desplazamiento, setDesplazamiento] = useState(() => {
    if (prefill) return DESPLAZAMIENTO_INICIAL;
    const cacheado = borradorInicialRef.current?.desplazamiento;
    return cacheado && typeof cacheado === 'object' ? { ...DESPLAZAMIENTO_INICIAL, ...cacheado } : DESPLAZAMIENTO_INICIAL;
  });

  const [intervension, setIntervension] = useState(() => {
    if (prefill) return INTERVENSION_INICIAL;
    const cacheado = borradorInicialRef.current?.intervension;
    return cacheado && typeof cacheado === 'object' ? { ...INTERVENSION_INICIAL, ...cacheado } : INTERVENSION_INICIAL;
  });

  const [seguimientoTiempo, setSeguimientoTiempo] = useState(() => {
    if (prefill) return SEGUIMIENTO_INICIAL;
    const cacheado = borradorInicialRef.current?.seguimientoTiempo;
    return cacheado && typeof cacheado === 'object' ? { ...SEGUIMIENTO_INICIAL, ...cacheado } : SEGUIMIENTO_INICIAL;
  });

  const [clientes, setClientes] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [ordenesAbiertas, setOrdenesAbiertas] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [materialesInventario, setMaterialesInventario] = useState([]);
  const [materialSeleccionadoId, setMaterialSeleccionadoId] = useState('');
  const [materialSeleccionadoCantidad, setMaterialSeleccionadoCantidad] = useState('1');
  const [materialesSeleccionados, setMaterialesSeleccionados] = useState(() => {
    if (prefill) return [];
    const cacheado = borradorInicialRef.current?.materialesSeleccionados;
    return Array.isArray(cacheado) ? cacheado : [];
  });
  const [fotosIntervencion, setFotosIntervencion] = useState([]);
  const [previewsFotos, setPreviewsFotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [capturandoTiempo, setCapturandoTiempo] = useState(false);
  const [capturandoDesplazamiento, setCapturandoDesplazamiento] = useState(false);
  const [capturandoIntervension, setCapturandoIntervension] = useState(false);
  const [capturandoPausaComida, setCapturandoPausaComida] = useState(false);
  const [pendienteGeoIntervension, setPendienteGeoIntervension] = useState(() => {
    if (prefill) return false;
    return Boolean(borradorInicialRef.current?.pendienteGeoIntervension);
  });
  const [firmaClienteDataUrl, setFirmaClienteDataUrl] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [pasoActual, setPasoActual] = useState(0);

  const canvasFirmaRef = useRef(null);
  const inputFotoAntesRef = useRef(null);
  const inputFotoDuranteRef = useRef(null);
  const inputFotoDespuesRef = useRef(null);
  const previewsFotosRef = useRef(new Map());
  const dibujandoFirmaRef = useRef(false);
  const ignorarGuardadoBorradorRef = useRef(false);
  const llegadaRegistradaRef = useRef(false);

  useEffect(() => {
    if (ignorarGuardadoBorradorRef.current) {
      ignorarGuardadoBorradorRef.current = false;
      return;
    }
    guardarBorradorParte({
      formulario,
      desplazamiento,
      intervension,
      seguimientoTiempo,
      materialesSeleccionados,
      pendienteGeoIntervension,
    });
  }, [desplazamiento, formulario, intervension, materialesSeleccionados, pendienteGeoIntervension, seguimientoTiempo]);

  return {
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
  };
}
