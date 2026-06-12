import { listarClientes } from './clientesService';
import { listarEquipos } from './equiposService';
import { listarTecnicos } from './tecnicosService';

// Caché local para catálogos de referencia con soporte offline.
const CACHE_KEY_TECNICOS = 'sat_cache_tecnicos_v1';
const CACHE_KEY_CLIENTES = 'sat_cache_clientes_v1';
const CACHE_KEY_EQUIPOS = 'sat_cache_equipos_v1';

function guardarEnCache(clave, items) {
  try {
    localStorage.setItem(clave, JSON.stringify(items));
  } catch { /* noop — storage lleno o no disponible */ }
}

function leerDeCache(clave) {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function aplicarFiltroYPaginacion(items, busqueda, limite, pagina) {
  const filtro = (busqueda || '').trim().toLowerCase();
  const filtrados = filtro
    ? items.filter((i) =>
        Object.values(i).some((v) => String(v ?? '').toLowerCase().includes(filtro))
      )
    : items;
  const desde = (pagina - 1) * limite;
  const slice = filtrados.slice(desde, desde + limite);
  return {
    items: slice,
    total: filtrados.length,
    hayMas: desde + limite < filtrados.length,
  };
}

function crearErrorCatalogoSinCache(etiqueta, errorOriginal) {
  const detalle = errorOriginal?.message ? ` ${errorOriginal.message}` : '';
  return new Error(
    `No se pudieron obtener los ${etiqueta} y no hay caché offline disponible.${detalle}`,
  );
}

export async function obtenerClientes(opciones = {}) {
  const { busqueda = '', limite = 20, pagina = 1 } = opciones;
  try {
    const items = await listarClientes();
    if (Array.isArray(items) && items.length > 0) {
      guardarEnCache(CACHE_KEY_CLIENTES, items);
    }
    return aplicarFiltroYPaginacion(items || [], busqueda, limite, pagina);
  } catch (error) {
    const cacheados = leerDeCache(CACHE_KEY_CLIENTES);
    if (cacheados.length > 0) {
      return aplicarFiltroYPaginacion(cacheados, busqueda, limite, pagina);
    }
    throw crearErrorCatalogoSinCache('clientes', error);
  }
}

export async function obtenerTecnicosActivos(opciones = {}) {
  const { busqueda = '', limite = 20, pagina = 1 } = opciones;
  try {
    const todos = await listarTecnicos();
    const activos = (todos || []).filter((t) => t.activo !== false);
    if (Array.isArray(activos) && activos.length > 0) {
      guardarEnCache(CACHE_KEY_TECNICOS, activos);
    }
    return aplicarFiltroYPaginacion(activos || [], busqueda, limite, pagina);
  } catch (error) {
    const cacheados = leerDeCache(CACHE_KEY_TECNICOS);
    if (cacheados.length > 0) {
      return aplicarFiltroYPaginacion(cacheados, busqueda, limite, pagina);
    }
    throw crearErrorCatalogoSinCache('técnicos', error);
  }
}

export async function obtenerEquiposPorCliente(clienteId, opciones = {}) {
  const { busqueda = '', limite = 20, pagina = 1 } = opciones;
  if (!clienteId) {
    return { items: [], total: 0, hayMas: false };
  }
  try {
    const todos = await listarEquipos();
    const equiposCliente = (todos || []).filter((e) => e.cliente_id === clienteId);
    if (Array.isArray(equiposCliente) && equiposCliente.length > 0) {
      guardarEnCache(CACHE_KEY_EQUIPOS, equiposCliente);
    }
    return aplicarFiltroYPaginacion(equiposCliente, busqueda, limite, pagina);
  } catch (error) {
    const cacheados = leerDeCache(CACHE_KEY_EQUIPOS);
    const equiposCliente = cacheados.filter((equipo) => equipo.cliente_id === clienteId);
    if (equiposCliente.length > 0) {
      return aplicarFiltroYPaginacion(equiposCliente, busqueda, limite, pagina);
    }
    throw crearErrorCatalogoSinCache('equipos', error);
  }
}

export async function precargarCatalogosOffline() {
  await Promise.allSettled([
    listarClientes().then((items) => guardarEnCache(CACHE_KEY_CLIENTES, items || [])),
    listarTecnicos().then((items) => guardarEnCache(CACHE_KEY_TECNICOS, (items || []).filter((t) => t.activo !== false))),
    listarEquipos().then((items) => guardarEnCache(CACHE_KEY_EQUIPOS, items || [])),
  ]);
}
