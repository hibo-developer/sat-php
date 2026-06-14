import { useEffect, useRef } from 'react';
import {
  comprimirImagenA1280,
  normalizarCategoriaFotoIntervencion,
} from '../services/parteTrabajoViewUtils';

export function useParteTrabajoMedia({
  canvasFirmaRef,
  dibujandoFirmaRef,
  fotosIntervencion,
  formulario,
  inputFotoAntesRef,
  inputFotoDuranteRef,
  inputFotoDespuesRef,
  numeroTicketPrefill,
  ordenesAbiertas,
  previewsFotosRef,
  setError,
  setFirmaClienteDataUrl,
  setFotosIntervencion,
  setMensaje,
  setPreviewsFotos,
}) {
  const permisoCamaraRef = useRef({ state: 'unknown', supported: false });

  useEffect(() => {
    let activo = true;
    let permiso = null;

    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return undefined;
    }

    permisoCamaraRef.current = { state: 'unknown', supported: true };

    (async () => {
      try {
        permiso = await navigator.permissions.query({ name: 'camera' });
        if (!activo) return;
        permisoCamaraRef.current = { state: permiso?.state || 'unknown', supported: true };
        if (permiso) {
          permiso.onchange = () => {
            permisoCamaraRef.current = { state: permiso?.state || 'unknown', supported: true };
          };
        }
      } catch {
        if (activo) {
          permisoCamaraRef.current = { state: 'unknown', supported: false };
        }
      }
    })();

    return () => {
      activo = false;
      if (permiso) {
        permiso.onchange = null;
      }
    };
  }, []);

  function abrirCapturaFoto(categoria) {
    const categoriaNormalizada = normalizarCategoriaFotoIntervencion(categoria);
    const inputRef = categoriaNormalizada === 'despues'
      ? inputFotoDespuesRef
      : categoriaNormalizada === 'durante'
        ? inputFotoDuranteRef
        : inputFotoAntesRef;
    const input = inputRef?.current || null;

    if (!input) {
      setMensaje('');
      setError('No se pudo inicializar la cámara en este dispositivo.');
      return;
    }

    const estadoPermiso = permisoCamaraRef.current?.state || 'unknown';
    setError('');
    if (estadoPermiso === 'denied') {
      setMensaje('El navegador indica que la cámara puede estar restringida, pero se intentará abrir igualmente.');
    } else if (estadoPermiso !== 'granted') {
      setMensaje('Si no se abre la cámara, revisa los permisos de Cámara para Chrome y vuelve a intentarlo.');
    } else {
      setMensaje('');
    }

    input.click();
  }

  function prepararCanvasFirma() {
    const canvas = canvasFirmaRef.current;
    if (!canvas) {
      return;
    }

    const contexto = canvas.getContext('2d');
    if (!contexto) {
      return;
    }

    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.lineWidth = 2;
    contexto.lineCap = 'round';
    contexto.lineJoin = 'round';
    contexto.strokeStyle = '#0f172a';
  }

  function limpiarFirma() {
    setFirmaClienteDataUrl('');
    dibujandoFirmaRef.current = false;
    prepararCanvasFirma();
  }

  function obtenerPuntoFirma(evento) {
    const canvas = canvasFirmaRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: evento.clientX - rect.left,
      y: evento.clientY - rect.top,
    };
  }

  function iniciarTrazoFirma(evento) {
    const canvas = canvasFirmaRef.current;
    if (!canvas) {
      return;
    }

    const contexto = canvas.getContext('2d');
    const punto = obtenerPuntoFirma(evento);
    if (!contexto || !punto) {
      return;
    }

    dibujandoFirmaRef.current = true;
    contexto.beginPath();
    contexto.moveTo(punto.x, punto.y);
  }

  function trazarFirma(evento) {
    if (!dibujandoFirmaRef.current) {
      return;
    }

    const canvas = canvasFirmaRef.current;
    if (!canvas) {
      return;
    }

    const contexto = canvas.getContext('2d');
    const punto = obtenerPuntoFirma(evento);
    if (!contexto || !punto) {
      return;
    }

    contexto.lineTo(punto.x, punto.y);
    contexto.stroke();
  }

  function terminarTrazoFirma() {
    const canvas = canvasFirmaRef.current;
    if (!canvas || !dibujandoFirmaRef.current) {
      return;
    }

    dibujandoFirmaRef.current = false;
    setFirmaClienteDataUrl(canvas.toDataURL('image/png'));
  }

  async function manejarSeleccionFotos(evento, categoria) {
    const archivos = Array.from(evento.target.files || []);
    evento.target.value = '';

    if (archivos.length === 0) {
      return;
    }

    const cat = normalizarCategoriaFotoIntervencion(categoria);
    const orden = ordenesAbiertas.find((o) => o.id === formulario.orden_id);
    const ticket = orden?.numero_ticket || numeroTicketPrefill || null;
    const otRef = ticket ? String(ticket) : (formulario.orden_id ? String(formulario.orden_id).slice(0, 8) : 'sin_ot');
    const base = `ot_${otRef}_${cat}_`;
    let contador = fotosIntervencion.filter((f) => f.name.includes(`_${cat}_`)).length;

    const maxPermitidas = 10;
    const disponibles = Math.max(0, maxPermitidas - fotosIntervencion.length);
    if (disponibles === 0) {
      setError('Límite alcanzado: máximo 10 fotos por parte.');
      return;
    }

    setError('');
    setMensaje('');

    const procesadas = [];
    for (const archivo of archivos.slice(0, disponibles)) {
      contador += 1;
      const nombreFinal = `${base}${String(contador).padStart(2, '0')}.jpg`;
      const comprimida = await comprimirImagenA1280(archivo, nombreFinal);
      if (comprimida) {
        procesadas.push(comprimida);
      }
    }

    if (procesadas.length === 0) {
      return;
    }

    setFotosIntervencion((previas) => {
      const mapa = new Map();
      [...previas, ...procesadas].forEach((archivo) => {
        const clave = `${archivo.name}-${archivo.size}-${archivo.lastModified}`;
        mapa.set(clave, archivo);
      });
      return Array.from(mapa.values()).slice(0, maxPermitidas);
    });
  }

  function quitarFotoIntervencion(indiceObjetivo) {
    setFotosIntervencion((prev) => prev.filter((_, indice) => indice !== indiceObjetivo));
  }

  useEffect(() => {
    prepararCanvasFirma();
  }, []);

  useEffect(() => {
    const mapa = previewsFotosRef.current;
    const nuevos = [];
    const activos = new Set();
    fotosIntervencion.forEach((foto) => {
      const clave = `${foto.name}-${foto.size}-${foto.lastModified}`;
      activos.add(clave);
      let url = mapa.get(clave);
      if (!url) {
        url = URL.createObjectURL(foto);
        mapa.set(clave, url);
      }
      nuevos.push({ clave, url, nombre: foto.name });
    });
    for (const [clave, url] of Array.from(mapa.entries())) {
      if (!activos.has(clave)) {
        URL.revokeObjectURL(url);
        mapa.delete(clave);
      }
    }
    setPreviewsFotos(nuevos);
  }, [fotosIntervencion, previewsFotosRef, setPreviewsFotos]);

  useEffect(() => () => {
    const mapa = previewsFotosRef.current;
    for (const url of mapa.values()) {
      URL.revokeObjectURL(url);
    }
    mapa.clear();
  }, [previewsFotosRef]);

  return {
    abrirCapturaFoto,
    iniciarTrazoFirma,
    limpiarFirma,
    manejarSeleccionFotos,
    quitarFotoIntervencion,
    terminarTrazoFirma,
    trazarFirma,
  };
}
