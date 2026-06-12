import { fetchJson } from './apiClient';
import {
  limpiarTexto,
  validarMinutos,
  validarPrioridad,
  validarTextoRequerido,
} from './satValidation';

function parsearMateriales(textoMateriales) {
  if (!textoMateriales.trim()) {
    return [];
  }

  return textoMateriales
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea, indice) => {
      const [nombre, cantidadRaw, precioRaw] = linea.split(';').map((v) => (v || '').trim());

      if (!nombre) {
        throw new Error(`El material de la línea ${indice + 1} no tiene nombre.`);
      }

      if (cantidadRaw && (!Number.isFinite(Number.parseInt(cantidadRaw, 10)) || Number.parseInt(cantidadRaw, 10) <= 0)) {
        throw new Error(`La cantidad del material en la línea ${indice + 1} debe ser mayor que cero.`);
      }

      if (precioRaw && !Number.isFinite(Number.parseFloat(precioRaw))) {
        throw new Error(`El precio del material en la línea ${indice + 1} no es válido.`);
      }

      const cantidad = cantidadRaw ? Number.parseInt(cantidadRaw, 10) : 1;
      const precio = precioRaw ? Number.parseFloat(precioRaw) : null;

      return {
        nombre_material: nombre,
        cantidad,
        precio_unitario: precio,
      };
    });
}

function formatearCoord(valor) {
  return Number.isFinite(Number(valor)) ? Number(valor).toFixed(5) : 'n/d';
}

function resolverMinutosFase(fase) {
  const minutosGeo = Number(fase?.minutosGeo);
  if (Number.isFinite(minutosGeo) && minutosGeo > 0) {
    return Math.round(minutosGeo);
  }

  if (!fase?.inicioIso || !fase?.finIso) {
    return null;
  }

  const inicioMs = new Date(fase.inicioIso).getTime();
  const finMs = new Date(fase.finIso).getTime();
  const diferenciaMs = finMs - inicioMs;
  if (!Number.isFinite(diferenciaMs) || diferenciaMs <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(diferenciaMs / 60000));
}

// Dirección fiscal de Cotepa S.L. (en futuros cambios, leer de tabla config_empresa)
function obtenerDireccionFiscalCotepa() {
  return {
    latitud: 39.4415,
    longitud: -0.3820,
    nombreLugar: 'Cotepa S.L., Paiporta',
    nombreLugarCompleto: 'Pol. Industrial La Pasqualeta, Calle Sequía de Rascanya, 46200 Paiporta, Valencia',
  };
}

function construirResumenDesplazamiento(desplazamiento) {
  if (!desplazamiento || !desplazamiento.inicioIso) {
    return null;
  }

  const lineas = ['Desplazamiento Cotepa a cliente'];
  lineas.push(`Inicio: ${desplazamiento.inicioIso}`);

  if (desplazamiento.finIso) {
    lineas.push(`Fin: ${desplazamiento.finIso}`);
  }

  if (desplazamiento.ubicacionInicio) {
    lineas.push(
      `Geo inicio (Cotepa): ${formatearCoord(desplazamiento.ubicacionInicio.latitud)}, ${formatearCoord(desplazamiento.ubicacionInicio.longitud)}`,
    );
  }

  if (desplazamiento.ubicacionFin) {
    lineas.push(
      `Geo fin (cliente): ${formatearCoord(desplazamiento.ubicacionFin.latitud)}, ${formatearCoord(desplazamiento.ubicacionFin.longitud)}`,
    );

    if (desplazamiento.ubicacionFin.nombreLugarCompleto || desplazamiento.ubicacionFin.nombreLugar) {
      lineas.push(
        `Lugar cliente: ${desplazamiento.ubicacionFin.nombreLugarCompleto || desplazamiento.ubicacionFin.nombreLugar}`,
      );
    }
  }

  if (Number.isFinite(Number(desplazamiento.distanciaMetros))) {
    const km = Math.round(Number(desplazamiento.distanciaMetros)) / 1000;
    lineas.push(`Distancia desplazamiento: ${km.toFixed(2)} km | Factura (ida+vuelta): ${km.toFixed(2)} km`);
  }

  const minutosDesplazamiento = resolverMinutosFase(desplazamiento);
  if (Number.isFinite(Number(minutosDesplazamiento))) {
    const minutos = Math.round(Number(minutosDesplazamiento));
    lineas.push(`Tiempo desplazamiento: ${minutos} minutos | Factura (ida+vuelta): ${minutos} minutos`);
  }

  return lineas.join(' | ');
}

function construirResumenIntervension(intervension) {
  if (!intervension || !intervension.inicioIso) {
    return null;
  }

  const lineas = ['Intervención en cliente'];
  lineas.push(`Inicio: ${intervension.inicioIso}`);

  if (intervension.finIso) {
    lineas.push(`Fin: ${intervension.finIso}`);
  }

  if (intervension.ubicacionInicio) {
    lineas.push(
      `Geo inicio: ${formatearCoord(intervension.ubicacionInicio.latitud)}, ${formatearCoord(intervension.ubicacionInicio.longitud)}`,
    );

    if (intervension.ubicacionInicio.nombreLugarCompleto || intervension.ubicacionInicio.nombreLugar) {
      lineas.push(
        `Lugar inicio: ${intervension.ubicacionInicio.nombreLugarCompleto || intervension.ubicacionInicio.nombreLugar}`,
      );
    }
  }

  if (intervension.ubicacionFin) {
    lineas.push(
      `Geo fin: ${formatearCoord(intervension.ubicacionFin.latitud)}, ${formatearCoord(intervension.ubicacionFin.longitud)}`,
    );

    if (intervension.ubicacionFin.nombreLugarCompleto || intervension.ubicacionFin.nombreLugar) {
      lineas.push(
        `Lugar fin: ${intervension.ubicacionFin.nombreLugarCompleto || intervension.ubicacionFin.nombreLugar}`,
      );
    }
  }

  if (Number.isFinite(Number(intervension.distanciaMetros))) {
    lineas.push(`Distancia geo: ${(Number(intervension.distanciaMetros) / 1000).toFixed(2)} km`);
  }

  const minutosIntervension = resolverMinutosFase(intervension);
  if (Number.isFinite(Number(minutosIntervension))) {
    lineas.push(`Tiempo intervención: ${Math.round(Number(minutosIntervension))} minutos`);
  }

  const pausasComida = Array.isArray(intervension.pausasComida) ? intervension.pausasComida : [];
  if (pausasComida.length > 0) {
    const totalPausaMinutos = pausasComida.reduce((acumulado, pausa) => {
      return acumulado + resolverMinutosFase(pausa);
    }, 0);
    lineas.push(`Pausas comida: ${pausasComida.length} | Total pausa: ${totalPausaMinutos} minutos`);

    pausasComida.forEach((pausa, indice) => {
      const minutos = resolverMinutosFase(pausa);
      lineas.push(`Pausa ${indice + 1}: ${pausa.inicioIso || 'N/D'} -> ${pausa.finIso || 'N/D'} (${minutos} min)`);
    });
  }

  return lineas.join(' | ');
}

function construirResumenGeolocalizacion(seguimientoTiempo) {
  if (!seguimientoTiempo || !seguimientoTiempo.inicioIso) {
    return null;
  }

  const lineas = ['Parte registrado desde movilidad'];
  lineas.push(`Inicio técnico: ${seguimientoTiempo.inicioIso}`);

  if (seguimientoTiempo.finIso) {
    lineas.push(`Fin técnico: ${seguimientoTiempo.finIso}`);
  }

  if (seguimientoTiempo.ubicacionInicio) {
    lineas.push(
      `Geo inicio: ${formatearCoord(seguimientoTiempo.ubicacionInicio.latitud)}, ${formatearCoord(seguimientoTiempo.ubicacionInicio.longitud)}`,
    );

    if (seguimientoTiempo.ubicacionInicio.nombreLugarCompleto || seguimientoTiempo.ubicacionInicio.nombreLugar) {
      lineas.push(
        `Lugar inicio: ${seguimientoTiempo.ubicacionInicio.nombreLugarCompleto || seguimientoTiempo.ubicacionInicio.nombreLugar}`,
      );
    }
  }

  if (seguimientoTiempo.ubicacionFin) {
    lineas.push(
      `Geo fin: ${formatearCoord(seguimientoTiempo.ubicacionFin.latitud)}, ${formatearCoord(seguimientoTiempo.ubicacionFin.longitud)}`,
    );

    if (seguimientoTiempo.ubicacionFin.nombreLugarCompleto || seguimientoTiempo.ubicacionFin.nombreLugar) {
      lineas.push(
        `Lugar fin: ${seguimientoTiempo.ubicacionFin.nombreLugarCompleto || seguimientoTiempo.ubicacionFin.nombreLugar}`,
      );
    }
  }

  if (Number.isFinite(Number(seguimientoTiempo.distanciaMetros))) {
    lineas.push(`Distancia geolocalizada: ${(Number(seguimientoTiempo.distanciaMetros) / 1000).toFixed(2)} km`);
  }

  if (Number.isFinite(Number(seguimientoTiempo.minutosGeo))) {
    lineas.push(`Tiempo por geolocalización: ${Math.round(Number(seguimientoTiempo.minutosGeo))} minutos`);
  }

  return lineas.join(' | ');
}

function resolverFechaIso(valor, fallback) {
  if (!valor) {
    return fallback;
  }

  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime())) {
    return fallback;
  }

  return fecha.toISOString();
}

function esDataUrlImagen(valor) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(valor || '');
}

function blobDesdeDataUrlImagen(dataUrl) {
  const raw = String(dataUrl || '');
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(raw);
  if (!match) {
    throw new Error('Data URL inválida.');
  }
  const mime = match[1] || 'image/png';
  const base64 = match[2] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function normalizarNombreEntidad(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ');
}

async function resolverOCrearClientePorNombre(supabase, nombreCliente) {
  const nombreNormalizado = normalizarNombreEntidad(nombreCliente);
  if (!nombreNormalizado) {
    return null;
  }

  const { data: clienteExistente, error: errorBusqueda } = await supabase
    .from('clientes')
    .select('id, nombre')
    .ilike('nombre', nombreNormalizado)
    .limit(1)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(`No se pudo buscar el cliente por nombre: ${errorBusqueda.message}`);
  }

  if (clienteExistente?.id) {
    return clienteExistente;
  }

  const { data: clienteCreado, error: errorCreacion } = await supabase
    .from('clientes')
    .insert({ nombre: nombreNormalizado })
    .select('id, nombre')
    .single();

  if (errorCreacion) {
    throw new Error(`No se pudo crear el cliente ${nombreNormalizado}: ${errorCreacion.message}`);
  }

  return clienteCreado;
}

async function resolverOCrearEquipoPorNombre(supabase, { clienteId, nombreEquipo }) {
  const nombreNormalizado = normalizarNombreEntidad(nombreEquipo);
  if (!nombreNormalizado) {
    return null;
  }

  const { data: equipoExistente, error: errorBusqueda } = await supabase
    .from('equipos')
    .select('id, nombre, cliente_id')
    .eq('cliente_id', clienteId)
    .ilike('nombre', nombreNormalizado)
    .limit(1)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(`No se pudo buscar el equipo por nombre: ${errorBusqueda.message}`);
  }

  if (equipoExistente?.id) {
    return equipoExistente;
  }

  const { data: equipoCreado, error: errorCreacion } = await supabase
    .from('equipos')
    .insert({
      cliente_id: clienteId,
      nombre: nombreNormalizado,
      marca: null,
      modelo: null,
    })
    .select('id, nombre, cliente_id')
    .single();

  if (errorCreacion) {
    throw new Error(`No se pudo crear el equipo ${nombreNormalizado}: ${errorCreacion.message}`);
  }

  return equipoCreado;
}

async function resolverBlobImagen(fuente) {
  if (fuente instanceof Blob) {
    return fuente;
  }

  if (esDataUrlImagen(fuente)) {
    return blobDesdeDataUrlImagen(fuente);
  }

  throw new Error('Formato de imagen no válido para subir a Storage.');
}

async function subirFirmaClienteStorage({ firmaDataUrl, clienteId, tecnicoId }) {
  if (!esDataUrlImagen(firmaDataUrl)) {
    return firmaDataUrl;
  }

  let blobFirma;
  try {
    blobFirma = await resolverBlobImagen(firmaDataUrl);
  } catch {
    throw new Error('No se pudo procesar la firma del cliente para subirla a Storage.');
  }

  const extension = blobFirma.type === 'image/jpeg' ? 'jpg' : 'png';
  const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const rutaPrefijo = `${clienteId}/${tecnicoId}`;
  const form = new FormData();
  form.append('bucket', 'firmas-clientes');
  form.append('pathPrefix', rutaPrefijo);
  form.append('file', blobFirma, nombreArchivo);
  const data = await fetchJson('/storage/upload', { method: 'POST', body: form });
  return data?.reference || '';
}

export async function subirFotosIntervencionStorage({ fotos, clienteId, tecnicoId, ordenId }) {
  const listaFotos = Array.isArray(fotos) ? fotos : [];
  if (listaFotos.length === 0) {
    return [];
  }

  const urls = [];

  for (let indice = 0; indice < listaFotos.length; indice += 1) {
    const foto = listaFotos[indice];
    let blobFoto;
    try {
      blobFoto = await resolverBlobImagen(foto);
    } catch {
      throw new Error(`No se pudo procesar la foto ${indice + 1} de la intervención.`);
    }

    const extension = blobFoto.type === 'image/jpeg' ? 'jpg' : blobFoto.type === 'image/webp' ? 'webp' : 'png';
    const nombreArchivo = `${Date.now()}-${indice + 1}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const rutaPrefijo = `${clienteId}/${tecnicoId}/${ordenId}`;
    const form = new FormData();
    form.append('bucket', 'fotos-intervenciones');
    form.append('pathPrefix', rutaPrefijo);
    form.append('file', blobFoto, nombreArchivo);
    const data = await fetchJson('/storage/upload', { method: 'POST', body: form });
    if (!data?.reference) {
      throw new Error(`No se pudo subir la foto ${indice + 1} de la intervención.`);
    }
    urls.push(data.reference);
  }

  return urls;
}

export async function obtenerOrdenesAbiertasParaParte(filtros = {}) {
  const clienteId = limpiarTexto(filtros.cliente_id);
  const tecnicoId = limpiarTexto(filtros.tecnico_id);
  const data = await fetchJson('/ordenes');
  const lista = Array.isArray(data) ? data : [];
  const abiertas = new Set(['pendiente', 'en_proceso', 'pausado']);
  return lista
    .filter((o) => abiertas.has(String(o.estado || '').toLowerCase()))
    .filter((o) => (clienteId ? o.cliente_id === clienteId : true))
    .filter((o) => (tecnicoId ? o.tecnico_id === tecnicoId : true))
    .map((o) => ({
      id: o.id,
      numero_ticket: o.numero_ticket,
      cliente_id: o.cliente_id || o.clientes?.id,
      equipo_id: o.equipo_id || o.equipos?.id || null,
      tecnico_id: o.tecnico_id || o.tecnicos?.id,
      descripcion_averia: o.descripcion_averia,
      estado: o.estado,
      prioridad: o.prioridad,
      fecha_inicio: o.fecha_inicio,
    }));
}

export async function crearParteTrabajo(payload) {
  const ordenIdEntrada = limpiarTexto(payload.orden_id);
  const clienteId = limpiarTexto(payload.cliente_id) || 'tmp';
  const equipoId = limpiarTexto(payload.equipo_id) || null;
  const clienteNombreEntrada = normalizarNombreEntidad(payload.cliente_nombre);
  const equipoNombreEntrada = normalizarNombreEntidad(payload.equipo_nombre);
  const tecnicoId = limpiarTexto(payload.tecnico_id);
  const descripcionProblema = validarTextoRequerido(payload.descripcion_problema, 'La descripción del problema', 8);
  const nombreFirmante = validarTextoRequerido(payload.nombre_firmante, 'El nombre de la persona firmante', 3);
  const prioridad = validarPrioridad(payload.prioridad || 'media');
  const materialesManual = parsearMateriales(payload.materialesTexto || '');
  const materialesInventarioEntrada = Array.isArray(payload.materialesInventario) ? payload.materialesInventario : [];
  const tiempoEmpleadoMinutos = validarMinutos(payload.tiempo_empleado);
  
  // Construir resúmenes para desplazamiento e intervención
  const resumenDesplazamiento = construirResumenDesplazamiento(payload.desplazamiento);
  const resumenIntervension = construirResumenIntervension(payload.intervension);
  const resumenGeo = [resumenDesplazamiento, resumenIntervension].filter(Boolean).join(' | ');
  
  const firmaEntrada = limpiarTexto(payload.firma_url);
  const fotosIntervencionEntrada = Array.isArray(payload.fotos_intervencion) ? payload.fotos_intervencion : [];
  const ahoraIso = new Date().toISOString();
  
  // Usar desplazamiento e intervención para calcular fechas
  const fechaInicio = resolverFechaIso(payload.desplazamiento?.inicioIso || payload.seguimientoTiempo?.inicioIso, ahoraIso);
  const fechaFin = resolverFechaIso(payload.intervension?.finIso || payload.seguimientoTiempo?.finIso, ahoraIso);

  if (!tecnicoId) {
    throw new Error('Debes asignar un técnico para registrar el parte.');
  }

  if (!firmaEntrada) {
    throw new Error('La firma del cliente es obligatoria para registrar el parte.');
  }

  const materialesInventarioNormalizados = materialesInventarioEntrada.map((item, indice) => {
    const materialId = limpiarTexto(item.material_id);
    const cantidad = Number.parseInt(item.cantidad, 10);

    if (!materialId) {
      throw new Error(`El material de inventario en la posicion ${indice + 1} no es valido.`);
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(`La cantidad del material de inventario en la posicion ${indice + 1} debe ser mayor que cero.`);
    }

    return {
      material_id: materialId,
      cantidad,
    };
  });

  const cantidadesPorMaterial = materialesInventarioNormalizados.reduce((acc, item) => {
    acc.set(item.material_id, (acc.get(item.material_id) || 0) + item.cantidad);
    return acc;
  }, new Map());

  const inventarioIds = [...cantidadesPorMaterial.keys()];

  const prefijoCliente = clienteId || 'tmp';
  const prefijoOrden = ordenIdEntrada || 'tmp';

  const firmaUrl = await subirFirmaClienteStorage({
    firmaDataUrl: firmaEntrada,
    clienteId: prefijoCliente,
    tecnicoId,
  });

  if (!firmaUrl) {
    throw new Error('No se pudo obtener la referencia de la firma del cliente.');
  }

  const fotosIntervencionUrls = await subirFotosIntervencionStorage({
    fotos: fotosIntervencionEntrada,
    clienteId: prefijoCliente,
    tecnicoId,
    ordenId: prefijoOrden,
  });

  const respuesta = await fetchJson('/partes', {
    method: 'POST',
    body: {
      orden_id: ordenIdEntrada || '',
      cliente_id: limpiarTexto(payload.cliente_id) || '',
      equipo_id: equipoId,
      cliente_nombre: clienteNombreEntrada || '',
      equipo_nombre: equipoNombreEntrada || '',
      tecnico_id: tecnicoId,
      descripcion_problema: descripcionProblema,
      nombre_firmante: nombreFirmante,
      prioridad,
      materialesTexto: payload.materialesTexto || '',
      materialesInventario: materialesInventarioNormalizados,
      tiempo_empleado: tiempoEmpleadoMinutos,
      tareas_realizadas_libre: String(payload?.tareas_realizadas_libre || '').trim(),
      mecanicos_intervinieron: payload?.mecanicos_intervinieron,
      desplazamiento: payload?.desplazamiento || null,
      intervension: payload?.intervension || null,
      seguimientoTiempo: payload?.seguimientoTiempo || null,
      firma_url: firmaUrl,
      fotos_intervencion: fotosIntervencionUrls,
    },
  });

  return respuesta;
}
