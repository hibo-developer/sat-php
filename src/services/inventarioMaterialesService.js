import { fetchJson } from './apiClient';

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function limpiarTextoOpcional(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }
  const limpio = limpiarTexto(String(valor));
  return limpio || null;
}

function validarEnteroNoNegativo(valor, campo) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${campo} debe ser un numero entero mayor o igual a 0.`);
  }
  return numero;
}

function validarPrecioOpcional(valor) {
  if (valor === null || valor === undefined || limpiarTexto(String(valor)) === '') {
    return null;
  }

  const numero = Number.parseFloat(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error('El precio de referencia no es valido.');
  }

  return numero;
}

async function buscarMaterialPorNombre(nombre) {
  const lista = await listarMaterialesInventario({ soloActivos: false });
  const buscado = limpiarTexto(nombre).toLowerCase();
  return lista.find((m) => limpiarTexto(m.nombre).toLowerCase() === buscado) || null;
}

export async function listarMaterialesInventario({ soloActivos = false } = {}) {
  const query = soloActivos ? '?soloActivos=1' : '';
  const data = await fetchJson(`/inventario/materiales${query}`);
  return Array.isArray(data) ? data : [];
}

export async function listarMovimientosInventario({ materialId = '', limite = 50 } = {}) {
  const materialIdNormalizado = limpiarTexto(materialId);
  const qp = new URLSearchParams();
  if (materialIdNormalizado) qp.set('materialId', materialIdNormalizado);
  qp.set('limite', String(limite));
  return fetchJson(`/inventario/movimientos?${qp.toString()}`);
}

export async function crearMaterialInventario(payload) {
  const nombre = limpiarTexto(payload.nombre);
  const descripcion = limpiarTexto(payload.descripcion) || null;
  const unidad = limpiarTexto(payload.unidad) || 'ud';
  const stockActual = validarEnteroNoNegativo(payload.stock_actual ?? 0, 'El stock inicial');
  const precioRef = validarPrecioOpcional(payload.precio_ref);
  const activo = payload.activo !== false;

  if (!nombre) {
    throw new Error('El nombre del material es obligatorio.');
  }

  return fetchJson('/inventario/materiales', {
    method: 'POST',
    body: {
      nombre,
      descripcion,
      unidad,
      stock_actual: stockActual,
      precio_ref: precioRef,
      activo,
    },
  });
}

export async function crearOActualizarMaterialInventario(payload) {
  const nombre = limpiarTexto(payload.nombre);
  const descripcion = limpiarTextoOpcional(payload.descripcion);
  const unidad = limpiarTexto(payload.unidad) || 'ud';
  const cantidadEntrada = validarEnteroNoNegativo(payload.stock_actual ?? 0, 'La cantidad');
  const precioRef = validarPrecioOpcional(payload.precio_ref);
  const activo = payload.activo !== false;
  const motivo = limpiarTexto(payload.motivo) || 'Alta o reposicion de stock';

  if (!nombre) {
    throw new Error('El nombre del material es obligatorio.');
  }

  const existente = await buscarMaterialPorNombre(nombre);

  if (!existente) {
    const creado = await crearMaterialInventario({
      nombre,
      descripcion,
      unidad,
      stock_actual: cantidadEntrada,
      precio_ref: precioRef,
      activo,
    });

    return {
      accion: 'creado',
      material: creado,
    };
  }

  const actualizado = await actualizarMaterialInventario(existente.id, {
    descripcion,
    unidad,
    precio_ref: precioRef,
    activo,
  });

  await regularizarStockMaterialInventario(existente.id, {
    modo: 'sumar',
    cantidad: cantidadEntrada,
    motivo,
  });

  return {
    accion: 'actualizado',
    material: actualizado,
  };
}

export async function actualizarMaterialInventario(id, payload) {
  const materialId = limpiarTexto(id);

  if (!materialId) {
    throw new Error('El material que intentas actualizar no es valido.');
  }

  const updatePayload = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'nombre')) {
    const nombre = limpiarTexto(payload.nombre);
    if (!nombre) {
      throw new Error('El nombre del material es obligatorio.');
    }
    updatePayload.nombre = nombre;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'descripcion')) {
    updatePayload.descripcion = limpiarTexto(payload.descripcion) || null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'unidad')) {
    updatePayload.unidad = limpiarTexto(payload.unidad) || 'ud';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'stock_actual')) {
    updatePayload.stock_actual = validarEnteroNoNegativo(payload.stock_actual, 'El stock actual');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'precio_ref')) {
    updatePayload.precio_ref = validarPrecioOpcional(payload.precio_ref);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'activo')) {
    updatePayload.activo = Boolean(payload.activo);
  }

  return fetchJson(`/inventario/materiales/${materialId}`, { method: 'PUT', body: updatePayload });
}

export async function regularizarStockMaterialInventario(id, payload) {
  const materialId = limpiarTexto(id);
  const modo = limpiarTexto(payload.modo || 'fijar').toLowerCase();
  const motivo = limpiarTexto(payload.motivo);

  if (!materialId) {
    throw new Error('El material para regularizar no es valido.');
  }

  if (!motivo) {
    throw new Error('Debes indicar un motivo para la regularizacion.');
  }

  if (modo === 'fijar') {
    validarEnteroNoNegativo(payload.cantidad, 'El stock regularizado');
  } else if (modo === 'sumar') {
    validarEnteroNoNegativo(payload.cantidad, 'La cantidad a sumar');
  } else if (modo === 'restar') {
    validarEnteroNoNegativo(payload.cantidad, 'La cantidad a restar');
  } else {
    throw new Error('El modo de regularizacion no es valido.');
  }

  return fetchJson(`/inventario/materiales/${materialId}/regularizar`, {
    method: 'POST',
    body: {
      modo,
      cantidad: validarEnteroNoNegativo(payload.cantidad, 'La cantidad'),
      motivo,
    },
  });
}

export async function eliminarMaterialInventario(id) {
  const materialId = limpiarTexto(id);

  if (!materialId) {
    throw new Error('El material que intentas eliminar no es valido.');
  }

  await fetchJson(`/inventario/materiales/${materialId}`, { method: 'DELETE', body: {} });
}
