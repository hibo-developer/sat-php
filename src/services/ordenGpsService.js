import { obtenerClienteSupabase } from './supabaseClient';
import { traducirErrorSupabase } from './erroresSupabase';

export async function insertarPuntoGps(payload) {
  const supabase = obtenerClienteSupabase();
  const { data, error } = await supabase
    .from('ordenes_trabajo_gps')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(traducirErrorSupabase(error, 'No se pudo registrar el punto GPS'));
  }

  return data;
}

