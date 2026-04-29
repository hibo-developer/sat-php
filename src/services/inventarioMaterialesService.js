import { obtenerClienteSupabase } from './supabaseClient';
import { traducirErrorSupabase } from './erroresSupabase';

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

function esErrorTablaMovimientosNoDisponible(error) {
  if (!error) {
    return false;
  }

  const codigo = limpiarTexto(error.code || '');
  const mensaje = limpiarTexto(String(error.message || '')).toLowerCase();

  if (codigo === '42P01' || codigo === 'PGRST205' || codigo === 'PGRST204') {
    return true;
  }

  return mensaje.includes('inventario_movimientos') && mensaje.includes('schema cache');
}

async function registrarMovimientoInventario(supabase, payload) {
  const { error } = await supabase.from('inventario_movimientos').insert(payload);

  if (!error) {
    return;
  }

  // Permite compatibilidad mientras no se haya aplicado la migracion de movimientos.
  if (esErrorTablaMovimientosNoDisponible(error)) {
    return;
  }

  throw new Error('No se pudo registrar movimiento.');
}

async function buscarMaterialPorNombre(supabase, nombre) {
  const { data, error } = await supabase
    .from('inventario_materiales')
    .select('id, nombre, descripcion, unidad, stock_actual, precio_ref, activo')
    .ilike('nombre', nombre)
    .limit(1);

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo validar el material en inventario'));
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}

export async function listarMaterialesInventario({ soloActivos = false } = {}) {
  const supabase = obtenerClienteSupabase();

  let consulta = supabase
    .from('inventario_materiales')
    .select('id, nombre, descripcion, unidad, stock_actual, precio_ref, activo, creado_en')
    .order('nombre', { ascending: true });

  if (soloActivos) {
    consulta = consulta.eq('activo', true);
  }

  const { data, error } = await consulta;

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudieron obtener los materiales de inventario'));
  }

  return data || [];
}

export async function listarMovimientosInventario({ materialId = '', limite = 50 } = {}) {
  const supabase = obtenerClienteSupabase();
  const materialIdNormalizado = limpiarTexto(materialId);

  let consulta = supabase
    .from('inventario_movimientos')
    .select(
      'id, material_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, creado_en, inventario_materiales(nombre, unidad)'
    )
    .order('creado_en', { ascending: false })
    .limit(limite);

  if (materialIdNormalizado) {
    consulta = consulta.eq('material_id', materialIdNormalizado);
  }

  const { data, error } = await consulta;

  if (error) {
    // Mantiene compatibilidad si la migracion aun no fue aplicada.
    if (esErrorTablaMovimientosNoDisponible(error)) {
      return {
        soportado: false,
        items: [],
      };
    }

    throw new Error('No se pudo cargar historial.');
  }

  return {
    soportado: true,
    items: data || [],
  };
}

export async function crearMaterialInventario(payload) {
  const supabase = obtenerClienteSupabase();

  const nombre = limpiarTexto(payload.nombre);
  const descripcion = limpiarTexto(payload.descripcion) || null;
  const unidad = limpiarTexto(payload.unidad) || 'ud';
  const stockActual = validarEnteroNoNegativo(payload.stock_actual ?? 0, 'El stock inicial');
  const precioRef = validarPrecioOpcional(payload.precio_ref);
  const activo = payload.activo !== false;

  if (!nombre) {
    throw new Error('El nombre del material es obligatorio.');
  }

  const { data, error } = await supabase
    .from('inventario_materiales')
    .insert({
      nombre,
      descripcion,
      unidad,
      stock_actual: stockActual,
      precio_ref: precioRef,
      activo,
    })
    .select()
    .single();

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo crear el material de inventario'));
  }

  return data;
}

export async function crearOActualizarMaterialInventario(payload) {
  const supabase = obtenerClienteSupabase();

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

  const existente = await buscarMaterialPorNombre(supabase, nombre);

  if (!existente) {
    const creado = await crearMaterialInventario({
      nombre,
      descripcion,
      unidad,
      stock_actual: cantidadEntrada,
      precio_ref: precioRef,
      activo,
    });

    await registrarMovimientoInventario(supabase, {
      material_id: creado.id,
      tipo_movimiento: 'alta',
      cantidad: cantidadEntrada,
      stock_anterior: 0,
      stock_nuevo: creado.stock_actual,
      motivo,
    });

    return {
      accion: 'creado',
      material: creado,
    };
  }

  const stockAnterior = Number(existente.stock_actual) || 0;
  const stockNuevo = stockAnterior + cantidadEntrada;

  const { data, error } = await supabase
    .from('inventario_materiales')
    .update({
      descripcion,
      unidad,
      stock_actual: stockNuevo,
      precio_ref: precioRef,
      activo,
    })
    .eq('id', existente.id)
    .select()
    .single();

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo actualizar el material existente en inventario'));
  }

  await registrarMovimientoInventario(supabase, {
    material_id: data.id,
    tipo_movimiento: 'entrada',
    cantidad: cantidadEntrada,
    stock_anterior: stockAnterior,
    stock_nuevo: data.stock_actual,
    motivo,
  });

  return {
    accion: 'actualizado',
    material: data,
  };
}

export async function actualizarMaterialInventario(id, payload) {
  const supabase = obtenerClienteSupabase();
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

  const { data, error } = await supabase
    .from('inventario_materiales')
    .update(updatePayload)
    .eq('id', materialId)
    .select()
    .single();

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo actualizar el material de inventario'));
  }

  return data;
}

export async function regularizarStockMaterialInventario(id, payload) {
  const supabase = obtenerClienteSupabase();
  const materialId = limpiarTexto(id);
  const modo = limpiarTexto(payload.modo || 'fijar').toLowerCase();
  const motivo = limpiarTexto(payload.motivo);

  if (!materialId) {
    throw new Error('El material para regularizar no es valido.');
  }

  if (!motivo) {
    throw new Error('Debes indicar un motivo para la regularizacion.');
  }

  const { data: materialDb, error: errorMaterial } = await supabase
    .from('inventario_materiales')
    .select('id, stock_actual')
    .eq('id', materialId)
    .single();

  if (errorMaterial || !materialDb) {
    throw new Error(traducirErrorSupabase(errorMaterial, 'No se encontro el material a regularizar'));
  }

  const stockAnterior = Number(materialDb.stock_actual) || 0;
  let stockNuevo = stockAnterior;
  let cantidadMovimiento = 0;

  if (modo === 'fijar') {
    const nuevoStock = validarEnteroNoNegativo(payload.cantidad, 'El stock regularizado');
    stockNuevo = nuevoStock;
    cantidadMovimiento = stockNuevo - stockAnterior;
  } else if (modo === 'sumar') {
    const cantidad = validarEnteroNoNegativo(payload.cantidad, 'La cantidad a sumar');
    stockNuevo = stockAnterior + cantidad;
    cantidadMovimiento = cantidad;
  } else if (modo === 'restar') {
    const cantidad = validarEnteroNoNegativo(payload.cantidad, 'La cantidad a restar');
    if (cantidad > stockAnterior) {
      throw new Error('No puedes restar mas stock del disponible.');
    }
    stockNuevo = stockAnterior - cantidad;
    cantidadMovimiento = -cantidad;
  } else {
    throw new Error('El modo de regularizacion no es valido.');
  }

  const { data, error } = await supabase
    .from('inventario_materiales')
    .update({ stock_actual: stockNuevo })
    .eq('id', materialId)
    .select()
    .single();

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo regularizar el stock del material'));
  }

  await registrarMovimientoInventario(supabase, {
    material_id: materialId,
    tipo_movimiento: 'regularizacion',
    cantidad: cantidadMovimiento,
    stock_anterior: stockAnterior,
    stock_nuevo: stockNuevo,
    motivo,
  });

  return data;
}

export async function eliminarMaterialInventario(id) {
  const supabase = obtenerClienteSupabase();
  const materialId = limpiarTexto(id);

  if (!materialId) {
    throw new Error('El material que intentas eliminar no es valido.');
  }

  const { error } = await supabase.from('inventario_materiales').delete().eq('id', materialId);

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo eliminar el material de inventario'));
  }
}
