import { obtenerClienteSupabase } from './supabaseClient';

async function asegurarRegistroTecnicoParaAdminActual(supabase) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return;
  }

  const userId = authData?.user?.id;
  if (!userId) {
    return;
  }

  const { data: usuarioSat, error: usuarioSatError } = await supabase
    .from('usuarios_sat')
    .select('rol, nombre_visible')
    .eq('user_id', userId)
    .maybeSingle();

  if (usuarioSatError || usuarioSat?.rol !== 'admin') {
    return;
  }

  const { data: tecnicoActual, error: tecnicoError } = await supabase
    .from('tecnicos')
    .select('id, activo')
    .eq('user_id', userId)
    .maybeSingle();

  if (tecnicoError) {
    return;
  }

  if (!tecnicoActual) {
    const nombreAdmin = (usuarioSat.nombre_visible || authData.user.email || 'Administrador SAT').trim();
    await supabase.from('tecnicos').insert({
      nombre: nombreAdmin,
      especialidad: 'Administración SAT',
      activo: true,
      user_id: userId,
    });
    return;
  }

  if (!tecnicoActual.activo) {
    await supabase.from('tecnicos').update({ activo: true }).eq('id', tecnicoActual.id);
  }
}

export async function obtenerClientes(opciones = {}) {
  const { busqueda = '', limite = 20, pagina = 1 } = opciones;
  const supabase = obtenerClienteSupabase();
  const desde = (pagina - 1) * limite;
  const hasta = desde + limite - 1;

  let consulta = supabase
    .from('clientes')
    .select('id, nombre', { count: 'exact' })
    .order('nombre', { ascending: true })
    .range(desde, hasta);

  if (busqueda.trim()) {
    consulta = consulta.ilike('nombre', `%${busqueda.trim()}%`);
  }

  const { data, error, count } = await consulta;

  if (error) {
    throw new Error(`No se pudieron obtener los clientes: ${error.message}`);
  }

  return {
    items: data || [],
    total: count || 0,
    hayMas: Boolean(count && hasta + 1 < count),
  };
}

export async function obtenerTecnicosActivos(opciones = {}) {
  const { busqueda = '', limite = 20, pagina = 1 } = opciones;
  const supabase = obtenerClienteSupabase();
  await asegurarRegistroTecnicoParaAdminActual(supabase);
  const desde = (pagina - 1) * limite;
  const hasta = desde + limite - 1;

  let consulta = supabase
    .from('tecnicos')
    .select('id, nombre, especialidad', { count: 'exact' })
    .eq('activo', true)
    .order('nombre', { ascending: true })
    .range(desde, hasta);

  if (busqueda.trim()) {
    consulta = consulta.or(
      `nombre.ilike.%${busqueda.trim()}%,especialidad.ilike.%${busqueda.trim()}%`
    );
  }

  const { data, error, count } = await consulta;

  if (error) {
    throw new Error(`No se pudieron obtener los técnicos: ${error.message}`);
  }

  return {
    items: data || [],
    total: count || 0,
    hayMas: Boolean(count && hasta + 1 < count),
  };
}

export async function obtenerEquiposPorCliente(clienteId, opciones = {}) {
  const { busqueda = '', limite = 20, pagina = 1 } = opciones;
  if (!clienteId) {
    return { items: [], total: 0, hayMas: false };
  }

  const supabase = obtenerClienteSupabase();
  const desde = (pagina - 1) * limite;
  const hasta = desde + limite - 1;

  let consulta = supabase
    .from('equipos')
    .select('id, nombre, marca, modelo', { count: 'exact' })
    .eq('cliente_id', clienteId)
    .order('nombre', { ascending: true })
    .range(desde, hasta);

  if (busqueda.trim()) {
    consulta = consulta.or(
      `nombre.ilike.%${busqueda.trim()}%,marca.ilike.%${busqueda.trim()}%,modelo.ilike.%${busqueda.trim()}%`
    );
  }

  const { data, error, count } = await consulta;

  if (error) {
    throw new Error(`No se pudieron obtener los equipos: ${error.message}`);
  }

  return {
    items: data || [],
    total: count || 0,
    hayMas: Boolean(count && hasta + 1 < count),
  };
}
