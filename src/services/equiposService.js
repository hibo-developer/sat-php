import { obtenerClienteSupabase } from './supabaseClient';
import { traducirErrorSupabase } from './erroresSupabase';

export async function listarEquipos() {
  const supabase = obtenerClienteSupabase();

  const { data, error } = await supabase
    .from('equipos')
    .select('id, cliente_id, nombre, marca, modelo, numero_serie, ultima_revision, clientes ( nombre )')
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudieron obtener los equipos'));
  }

  return data || [];
}

export async function crearEquipo(payload) {
  const supabase = obtenerClienteSupabase();

  const { data, error } = await supabase.from('equipos').insert(payload).select().single();

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo crear el equipo'));
  }

  return data;
}

export async function actualizarEquipo(idEquipo, payload) {
  const supabase = obtenerClienteSupabase();

  const { data, error } = await supabase
    .from('equipos')
    .update(payload)
    .eq('id', idEquipo)
    .select()
    .single();

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo actualizar el equipo'));
  }

  return data;
}

export async function eliminarEquipo(idEquipo) {
  const supabase = obtenerClienteSupabase();

  const { error } = await supabase.from('equipos').delete().eq('id', idEquipo);

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo eliminar el equipo'));
  }
}
