/**
 * Traduce errores crudos de Supabase/PostgreSQL a mensajes entendibles para el usuario.
 *
 * @param {object} error  - Objeto error devuelto por Supabase ({ code, message, details, hint })
 * @param {string} accion - Texto base de la acción fallida, p.ej. "No se pudo eliminar el cliente"
 * @returns {string} Mensaje legible
 */
export function traducirErrorSupabase(error, accion) {
  if (!error) return `${accion}.`;

  const codigo = error.code ?? '';
  const mensaje = error.message ?? '';

  // ── Violación de clave foránea (23503) ───────────────────────────────────
  if (codigo === '23503' || mensaje.includes('foreign key constraint')) {
    if (mensaje.includes('ordenes_trabajo_cliente_id_fkey') || mensaje.includes('"clientes"')) {
      return 'No puedes eliminar este cliente porque tiene órdenes de trabajo asociadas. Elimina o reasigna primero esas órdenes.';
    }
    if (mensaje.includes('ordenes_trabajo_equipo_id_fkey') || mensaje.includes('"equipos"')) {
      return 'No puedes eliminar este equipo porque tiene órdenes de trabajo asociadas. Elimina o reasigna primero esas órdenes.';
    }
    if (mensaje.includes('ordenes_trabajo_tecnico_id_fkey') || mensaje.includes('"tecnicos"')) {
      return 'No puedes eliminar este técnico porque tiene órdenes de trabajo asociadas. Elimina o reasigna primero esas órdenes.';
    }
    if (mensaje.includes('materiales_orden') || mensaje.includes('"ordenes_trabajo"')) {
      return 'No puedes eliminar esta orden porque tiene materiales asociados. Elimina primero los materiales.';
    }
    // Genérico FK
    return `${accion}: tiene registros relacionados que deben eliminarse antes.`;
  }

  // ── Valor duplicado / unicidad (23505) ───────────────────────────────────
  if (codigo === '23505' || mensaje.includes('unique constraint') || mensaje.includes('duplicate key')) {
    return `${accion}: ya existe un registro con esos datos. Revisa los campos e inténtalo de nuevo.`;
  }

  // ── Campo obligatorio nulo (23502) ───────────────────────────────────────
  if (codigo === '23502' || mensaje.includes('null value in column')) {
    return `${accion}: falta un campo obligatorio. Completa todos los campos requeridos.`;
  }

  // ── Sin permisos RLS (42501) ──────────────────────────────────────────────
  if (codigo === '42501' || mensaje.includes('row-level security') || mensaje.includes('permission denied')) {
    return `${accion}: no tienes permisos para realizar esta operación.`;
  }

  // ── Sin conexión / timeout ────────────────────────────────────────────────
  if (mensaje.includes('Failed to fetch') || mensaje.includes('NetworkError') || mensaje.includes('timeout')) {
    return `${accion}: no se pudo conectar con el servidor. Comprueba tu conexión a internet.`;
  }

  // ── Fallback: acción + mensaje original abreviado ─────────────────────────
  return `${accion}: ${mensaje}`;
}
