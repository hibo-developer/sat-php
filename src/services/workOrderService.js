import { obtenerClienteSupabase } from './supabaseClient';
import {
  limpiarTexto,
  normalizarDescripcion,
  validarMinutos,
  validarPrioridad,
  validarTextoRequerido,
  validarUrlOpcional,
} from './satValidation';

const ESTADOS_EDITABLES = new Set(['pendiente', 'en_proceso', 'pausado']);

function validarEstadoEditable(estado) {
  const estadoLimpio = limpiarTexto(estado).toLowerCase();

  if (!ESTADOS_EDITABLES.has(estadoLimpio)) {
    throw new Error('El estado seleccionado no es válido para una orden abierta.');
  }

  return estadoLimpio;
}

async function obtenerContextoUsuarioSat(supabase) {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`No se pudo validar la sesion actual: ${authError.message}`);
  }

  const usuario = authData?.user;
  if (!usuario) {
    throw new Error('No hay una sesion activa. Inicia sesion para operar ordenes.');
  }

  const [rolRsp, tecnicoRsp] = await Promise.all([
    supabase.from('usuarios_sat').select('rol').eq('user_id', usuario.id).maybeSingle(),
    supabase.from('tecnicos').select('id, nombre, activo').eq('user_id', usuario.id).maybeSingle(),
  ]);

  if (rolRsp.error) {
    throw new Error(`No se pudo validar el rol del usuario: ${rolRsp.error.message}`);
  }

  if (tecnicoRsp.error) {
    throw new Error(`No se pudo validar el tecnico vinculado al usuario: ${tecnicoRsp.error.message}`);
  }

  return {
    rol: rolRsp.data?.rol || null,
    tecnicoId: tecnicoRsp.data?.id || null,
    tecnicoNombre: tecnicoRsp.data?.nombre || null,
  };
}

function validarAsignacionTecnicoEnOrden(contextoUsuario, ordenActual, accion) {
  if (contextoUsuario.rol !== 'tecnico') {
    return;
  }

  if (!contextoUsuario.tecnicoId) {
    throw new Error(
      'Tu usuario esta en rol tecnico pero no esta vinculado a ningun registro en tecnicos. Vincula auth.users.id en tecnicos.user_id para poder ' +
        accion +
        ' ordenes.',
    );
  }

  if (ordenActual.tecnico_id !== contextoUsuario.tecnicoId) {
    throw new Error('Solo puedes operar ordenes asignadas a tu tecnico. Revisa la asignacion del tecnico en la orden.');
  }
}

async function validarReferenciasOrden(supabase, ordenNueva) {
  const { cliente_id: clienteId, equipo_id: equipoId, tecnico_id: tecnicoId } = ordenNueva;

  const { data: cliente, error: errorCliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('id', clienteId)
    .maybeSingle();

  if (errorCliente) {
    throw new Error(`No se pudo validar el cliente seleccionado: ${errorCliente.message}`);
  }

  if (!cliente) {
    throw new Error('El cliente seleccionado no existe.');
  }

  if (equipoId) {
    const { data: equipo, error: errorEquipo } = await supabase
      .from('equipos')
      .select('id, cliente_id')
      .eq('id', equipoId)
      .maybeSingle();

    if (errorEquipo) {
      throw new Error(`No se pudo validar el equipo seleccionado: ${errorEquipo.message}`);
    }

    if (!equipo) {
      throw new Error('El equipo seleccionado no existe.');
    }

    if (equipo.cliente_id !== clienteId) {
      throw new Error('El equipo seleccionado no pertenece al cliente indicado.');
    }
  }

  if (tecnicoId) {
    const { data: tecnico, error: errorTecnico } = await supabase
      .from('tecnicos')
      .select('id, activo')
      .eq('id', tecnicoId)
      .maybeSingle();

    if (errorTecnico) {
      throw new Error(`No se pudo validar el técnico seleccionado: ${errorTecnico.message}`);
    }

    if (!tecnico) {
      throw new Error('El técnico seleccionado no existe.');
    }

    if (!tecnico.activo) {
      throw new Error('El técnico seleccionado está inactivo.');
    }
  }
}

async function validarOrdenDuplicadaAbierta(supabase, ordenNueva) {
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('id, descripcion_averia, estado, equipo_id')
    .eq('cliente_id', ordenNueva.cliente_id)
    .in('estado', ['pendiente', 'en_proceso', 'pausado'])
    .order('fecha_inicio', { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`No se pudo comprobar si existe una orden abierta similar: ${error.message}`);
  }

  const descripcionNueva = normalizarDescripcion(ordenNueva.descripcion_averia);
  const duplicada = (data || []).find((ordenExistente) => {
    const mismaDescripcion = normalizarDescripcion(ordenExistente.descripcion_averia) === descripcionNueva;
    const mismoEquipo = !ordenNueva.equipo_id || !ordenExistente.equipo_id || ordenExistente.equipo_id === ordenNueva.equipo_id;
    return mismaDescripcion && mismoEquipo;
  });

  if (duplicada) {
    throw new Error('Ya existe una orden abierta con la misma avería para este cliente.');
  }
}

/**
 * Obtiene todas las órdenes de trabajo.
 */
export async function obtenerOrdenesTrabajo() {
  const supabase = obtenerClienteSupabase();

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select(
      `
      id,
      numero_ticket,
      descripcion_averia,
      tareas_realizadas,
      tiempo_empleado_minutos,
      estado,
      prioridad,
      foto_url,
      informe_pdf_url,
      fecha_inicio,
      fecha_fin,
      clientes ( id, nombre ),
      equipos ( id, nombre, marca, modelo ),
      tecnicos ( id, nombre ),
      materiales_orden ( id, nombre_material, cantidad, precio_unitario )
    `
    )
    .order('fecha_inicio', { ascending: false });

  if (error) {
    throw new Error(`No se pudieron obtener las órdenes de trabajo: ${error.message}`);
  }

  return data;
}

/**
 * Crea una nueva orden de trabajo.
 * Recibe un objeto con los campos de la tabla ordenes_trabajo.
 */
export async function crearOrdenTrabajo(ordenNueva) {
  const supabase = obtenerClienteSupabase();

  const clienteId = limpiarTexto(ordenNueva.cliente_id);
  if (!clienteId) {
    throw new Error('Debes seleccionar un cliente para crear la orden.');
  }

  const descripcionAveria = validarTextoRequerido(ordenNueva.descripcion_averia, 'La descripción de la avería', 8);
  const prioridad = validarPrioridad(ordenNueva.prioridad ?? 'media');
  const equipoId = limpiarTexto(ordenNueva.equipo_id) || null;
  const tecnicoId = limpiarTexto(ordenNueva.tecnico_id);

  if (!tecnicoId) {
    throw new Error('Debes asignar un técnico antes de crear la orden.');
  }

  await validarReferenciasOrden(supabase, {
    cliente_id: clienteId,
    equipo_id: equipoId,
    tecnico_id: tecnicoId,
  });
  await validarOrdenDuplicadaAbierta(supabase, {
    cliente_id: clienteId,
    equipo_id: equipoId,
    descripcion_averia: descripcionAveria,
  });

  const payload = {
    cliente_id: clienteId,
    equipo_id: equipoId,
    tecnico_id: tecnicoId,
    descripcion_averia: descripcionAveria,
    tareas_realizadas: ordenNueva.tareas_realizadas ?? null,
    tiempo_empleado_minutos: ordenNueva.tiempo_empleado_minutos ?? null,
    estado: ordenNueva.estado ?? 'pendiente',
    prioridad,
    foto_url: validarUrlOpcional(ordenNueva.foto_url, 'La URL de la foto') ?? null,
    firma_url: ordenNueva.firma_url ?? null,
    fecha_inicio: ordenNueva.fecha_inicio ?? new Date().toISOString(),
    fecha_fin: ordenNueva.fecha_fin ?? null,
  };

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`No se pudo crear la orden de trabajo: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza una orden al estado finalizado,
 * guardando tareas realizadas y la foto del trabajo.
 */
export async function finalizarOrdenTrabajo(idOrden, { tareasRealizadas, fotoUrl, tiempoEmpleadoMinutos }) {
  const supabase = obtenerClienteSupabase();
  const contextoUsuario = await obtenerContextoUsuarioSat(supabase);

  const ordenId = limpiarTexto(idOrden);
  if (!ordenId) {
    throw new Error('La orden que intentas finalizar no es válida.');
  }

  const tareas = validarTextoRequerido(tareasRealizadas, 'Las tareas realizadas', 8);
  const minutos = validarMinutos(tiempoEmpleadoMinutos, 'El tiempo de cierre');
  const foto = validarUrlOpcional(fotoUrl, 'La URL de la foto');

  const { data: ordenActual, error: errorOrdenActual } = await supabase
    .from('ordenes_trabajo')
    .select('id, tecnico_id, estado')
    .eq('id', ordenId)
    .maybeSingle();

  if (errorOrdenActual) {
    throw new Error(`No se pudo validar la orden antes del cierre: ${errorOrdenActual.message}`);
  }

  if (!ordenActual) {
    throw new Error('La orden que intentas finalizar ya no existe.');
  }

  if (!ordenActual.tecnico_id) {
    throw new Error('No se puede finalizar una orden sin técnico asignado.');
  }

  if (ordenActual.estado === 'finalizado') {
    throw new Error('La orden seleccionada ya está finalizada.');
  }

  validarAsignacionTecnicoEnOrden(contextoUsuario, ordenActual, 'finalizar');

  const actualizacion = {
    estado: 'finalizado',
    tareas_realizadas: tareas,
    tiempo_empleado_minutos: minutos,
    foto_url: foto,
    fecha_fin: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update(actualizacion)
    .eq('id', ordenId)
    .select()
    .single();

  if (error) {
    throw new Error(`No se pudo finalizar la orden de trabajo: ${error.message}`);
  }

  return data;
}

export async function actualizarOrdenTrabajo(idOrden, cambios) {
  const supabase = obtenerClienteSupabase();
  const contextoUsuario = await obtenerContextoUsuarioSat(supabase);
  const ordenId = limpiarTexto(idOrden);

  if (!ordenId) {
    throw new Error('La orden que intentas actualizar no es válida.');
  }

  const tecnicoId = limpiarTexto(cambios.tecnico_id);
  if (!tecnicoId) {
    throw new Error('Debes asignar un técnico válido a la orden.');
  }

  const prioridad = validarPrioridad(cambios.prioridad ?? 'media');
  const estado = validarEstadoEditable(cambios.estado ?? 'pendiente');

  const { data: ordenActual, error: errorOrdenActual } = await supabase
    .from('ordenes_trabajo')
    .select('id, cliente_id, equipo_id, estado')
    .eq('id', ordenId)
    .maybeSingle();

  if (errorOrdenActual) {
    throw new Error(`No se pudo validar la orden antes de actualizarla: ${errorOrdenActual.message}`);
  }

  if (!ordenActual) {
    throw new Error('La orden que intentas editar ya no existe.');
  }

  if (ordenActual.estado === 'finalizado') {
    throw new Error('No se puede editar una orden que ya está finalizada.');
  }

  validarAsignacionTecnicoEnOrden(contextoUsuario, ordenActual, 'editar');

  await validarReferenciasOrden(supabase, {
    cliente_id: ordenActual.cliente_id,
    equipo_id: ordenActual.equipo_id,
    tecnico_id: tecnicoId,
  });

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({
      tecnico_id: tecnicoId,
      prioridad,
      estado,
    })
    .eq('id', ordenId)
    .select()
    .single();

  if (error) {
    if ((error.message || '').includes('Solo puedes editar ordenes asignadas a tu tecnico')) {
      throw new Error(
        'Solo puedes editar ordenes asignadas a tu tecnico. Verifica que el usuario actual este vinculado en tecnicos.user_id y que la orden tenga ese tecnico.',
      );
    }

    throw new Error(`No se pudo actualizar la orden de trabajo: ${error.message}`);
  }

  return data;
}

/**
 * Guarda la URL del informe PDF en la orden de trabajo.
 */
export async function guardarInformePdfUrl(ordenId, pdfUrl) {
  const supabase = obtenerClienteSupabase();
  const id = limpiarTexto(ordenId);
  if (!id) {
    throw new Error('ID de orden requerido para guardar el informe PDF.');
  }

  const { error } = await supabase
    .from('ordenes_trabajo')
    .update({ informe_pdf_url: pdfUrl })
    .eq('id', id);

  if (error) {
    throw new Error(`No se pudo guardar la URL del informe PDF: ${error.message}`);
  }
}
