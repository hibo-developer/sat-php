import { obtenerClienteSupabase } from './supabaseClient';
import { traducirErrorSupabase } from './erroresSupabase';

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
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
