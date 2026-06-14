export function obtenerUbicacionActual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este dispositivo no soporta geolocalización.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        resolve({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precisionMetros: posicion.coords.accuracy,
          timestamp: posicion.timestamp,
        });
      },
      (err) => {
        reject(new Error(`No se pudo obtener la ubicación (${err.message}).`));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  });
}

export async function resolverNombreLugar(latitud, longitud) {
  try {
    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitud}&lon=${longitud}&zoom=18&addressdetails=1`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'es',
        },
      },
    );

    if (!respuesta.ok) {
      return null;
    }

    const data = await respuesta.json();
    const address = data.address || {};
    const via = address.road || address.pedestrian || address.footway || address.cycleway || address.path;
    const numero = address.house_number;
    const barrio = address.suburb || address.neighbourhood || address.city_district;
    const localidad = address.city || address.town || address.village || address.municipality;
    const provincia = address.state || address.county;

    const tramoVia = [via, numero].filter(Boolean).join(', ');
    const partes = [tramoVia, barrio, localidad, provincia].filter(Boolean);
    const nombreLugarCompleto = partes.join(' | ') || data.display_name || null;
    const nombreLugarCorto = [localidad, provincia].filter(Boolean).join(' | ') || nombreLugarCompleto;

    return {
      nombreLugar: nombreLugarCorto,
      nombreLugarCompleto,
    };
  } catch {
    return null;
  }
}

export function normalizarDireccion(direccion) {
  return String(direccion || '')
    .replace(/[·•]/g, ' ')
    .replace(/N[º°]\s*/gi, 'N ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function geocodificarDireccion(direccion) {
  const q = normalizarDireccion(direccion);
  if (!q) return null;
  try {
    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'es',
        },
      },
    );

    if (!respuesta.ok) {
      return null;
    }

    const data = await respuesta.json();
    const primer = Array.isArray(data) ? data[0] : null;
    const lat = primer?.lat ? Number(primer.lat) : null;
    const lng = primer?.lon ? Number(primer.lon) : null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { lat, lng };
  } catch {
    return null;
  }
}

export const UBICACION_COTEPA = {
  latitud: 39.4415,
  longitud: -0.3820,
  nombreLugar: 'Cotepa S.L., Paiporta',
  nombreLugarCompleto: 'Pol. Industrial La Pasqualeta, Calle Sequía de Rascanya, 46200 Paiporta, Valencia',
};

export function calcularDistanciaMetros(origen, destino) {
  if (!origen || !destino) {
    return null;
  }

  const radioTierra = 6371000;
  const lat1 = (origen.latitud * Math.PI) / 180;
  const lat2 = (destino.latitud * Math.PI) / 180;
  const deltaLat = ((destino.latitud - origen.latitud) * Math.PI) / 180;
  const deltaLon = ((destino.longitud - origen.longitud) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(radioTierra * c);
}

export async function calcularDistanciaCarreteraMetros(origen, destino) {
  if (!origen || !destino) {
    return null;
  }

  const haversine = calcularDistanciaMetros(origen, destino);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origen.longitud},${origen.latitud};${destino.longitud},${destino.latitud}?overview=false&alternatives=false&steps=false`;
    const controlador = new AbortController();
    const tiempoLimite = setTimeout(() => controlador.abort(), 8000);
    const respuesta = await fetch(url, { signal: controlador.signal, headers: { Accept: 'application/json' } });
    clearTimeout(tiempoLimite);

    if (!respuesta.ok) {
      throw new Error(`OSRM HTTP ${respuesta.status}`);
    }

    const data = await respuesta.json();
    const ruta = Array.isArray(data?.routes) ? data.routes[0] : null;
    const metrosRuta = ruta && Number.isFinite(Number(ruta.distance)) ? Math.round(Number(ruta.distance)) : null;

    if (metrosRuta && metrosRuta > 0) {
      return metrosRuta;
    }
  } catch {
    // se usa el fallback Haversine × 1.3
  }

  if (Number.isFinite(haversine)) {
    return Math.round(haversine * 1.3);
  }
  return null;
}

export function redondearMinutos(inicioIso, finIso) {
  const inicioMs = new Date(inicioIso).getTime();
  const finMs = new Date(finIso).getTime();
  const diferenciaMs = finMs - inicioMs;

  if (!Number.isFinite(diferenciaMs) || diferenciaMs <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(diferenciaMs / 60000));
}

export function calcularMinutosPausasComida(pausasComida) {
  const pausas = Array.isArray(pausasComida) ? pausasComida : [];
  return pausas.reduce((acumulado, pausa) => {
    if (!pausa?.inicioIso || !pausa?.finIso) {
      return acumulado;
    }

    return acumulado + redondearMinutos(pausa.inicioIso, pausa.finIso);
  }, 0);
}

export function formatearUbicacion(ubicacion) {
  if (!ubicacion) {
    return 'No disponible';
  }

  return `${ubicacion.latitud.toFixed(5)}, ${ubicacion.longitud.toFixed(5)}`;
}

export function formatearLugar(ubicacion) {
  return ubicacion?.nombreLugar || 'No disponible';
}

export function parsearNumeroDecimal(valor) {
  const numero = Number.parseFloat(String(valor || '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

export function construirUrlRutaCliente({ lat, lng, direccion, modoNavegacion = false }) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum) && !(latNum === 0 && lngNum === 0)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latNum},${lngNum}&travelmode=driving${modoNavegacion ? '&dir_action=navigate' : ''}`;
  }
  const dir = normalizarDireccion(direccion);
  if (dir) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}&travelmode=driving${modoNavegacion ? '&dir_action=navigate' : ''}`;
  }
  return '';
}

export async function comprimirImagenA1280(archivo, nombreFinal) {
  const file = archivo instanceof File ? archivo : null;
  if (!file) return null;
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      el.src = blobUrl;
    });

    const maxPx = 1280;
    const ancho = img.naturalWidth || img.width;
    const alto = img.naturalHeight || img.height;
    const escala = Math.min(1, maxPx / Math.max(ancho, alto));
    const nuevoAncho = Math.max(1, Math.round(ancho * escala));
    const nuevoAlto = Math.max(1, Math.round(alto * escala));

    const canvas = document.createElement('canvas');
    canvas.width = nuevoAncho;
    canvas.height = nuevoAlto;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return new File([file], nombreFinal, { type: file.type || 'image/jpeg', lastModified: Date.now() });
    }
    ctx.drawImage(img, 0, 0, nuevoAncho, nuevoAlto);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82);
    });
    if (!blob) {
      return new File([file], nombreFinal, { type: file.type || 'image/jpeg', lastModified: Date.now() });
    }

    return new File([blob], nombreFinal, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export const FORM_INICIAL = {
  orden_id: '',
  cliente_id: '',
  cliente_nombre: '',
  equipo_id: '',
  equipo_nombre: '',
  tecnico_id: '',
  nombre_firmante: '',
  descripcion_problema: '',
  tareas_realizadas_libre: '',
  materialesTexto: '',
  tiempo_empleado: '60',
  mecanicos_intervinieron: '1',
  prioridad: 'media',
};

export const DESPLAZAMIENTO_INICIAL = {
  inicioIso: null,
  finIso: null,
  ubicacionInicio: null,
  ubicacionFin: null,
  distanciaMetros: null,
  minutosGeo: null,
};

export const INTERVENSION_INICIAL = {
  inicioIso: null,
  finIso: null,
  ubicacionInicio: null,
  ubicacionFin: null,
  distanciaMetros: null,
  minutosGeo: null,
  pausasComida: [],
  pausaComidaActiva: null,
};

export const SEGUIMIENTO_INICIAL = {
  inicioIso: null,
  finIso: null,
  ubicacionInicio: null,
  ubicacionFin: null,
  distanciaMetros: null,
  minutosGeo: null,
};

export const PASOS_PARTE = [
  { id: 'contexto', titulo: 'Contexto', descripcion: 'Cliente, equipo y orden' },
  { id: 'tiempos', titulo: 'Tiempos', descripcion: 'Desplazamiento e intervención' },
  { id: 'ejecucion', titulo: 'Ejecución', descripcion: 'Trabajo, materiales y evidencias' },
  { id: 'cierre', titulo: 'Cierre', descripcion: 'Firma y registro final' },
];

const CACHE_KEY_PARTE_BORRADOR = 'sat_cache_parte_borrador_v1';
const MAX_EDAD_BORRADOR_MS = 1000 * 60 * 60 * 24 * 7;

export function leerBorradorParte() {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PARTE_BORRADOR);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.updatedAt && Date.now() - parsed.updatedAt > MAX_EDAD_BORRADOR_MS) {
      localStorage.removeItem(CACHE_KEY_PARTE_BORRADOR);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function guardarBorradorParte(payload) {
  try {
    localStorage.setItem(CACHE_KEY_PARTE_BORRADOR, JSON.stringify({
      ...payload,
      updatedAt: Date.now(),
    }));
  } catch {}
}

export function limpiarBorradorParte() {
  try {
    localStorage.removeItem(CACHE_KEY_PARTE_BORRADOR);
  } catch {}
}
