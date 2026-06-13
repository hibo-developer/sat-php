import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const inputDir =
  process.argv[2]?.trim() ||
  path.resolve(process.cwd(), 'migration-data', 'supabase-export');
const outputFile =
  process.argv[3]?.trim() || path.resolve(process.cwd(), 'sql', 'dondominio_data_seed.sql');

async function readJson(fileName) {
  const filePath = path.join(inputDir, fileName);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function sqlString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function sqlValue(value, { dateOnly = false, dateTime = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }

  if (dateOnly) {
    const text = String(value);
    return sqlString(text.slice(0, 10));
  }

  if (dateTime) {
    const text = String(value).replace('T', ' ').replace('Z', '');
    return sqlString(text.slice(0, 19));
  }

  return sqlString(value);
}

function insertStatement(table, columns, rows, mapRow) {
  if (!rows.length) {
    return `-- ${table}: sin filas\n`;
  }

  const values = rows
    .map((row) => {
      const mapped = mapRow(row);
      const cols = columns.map((col) => mapped[col] ?? 'NULL');
      return `(${cols.join(', ')})`;
    })
    .join(',\n');

  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};\n`;
}

function ensureRequired(row, key, table) {
  const value = row[key];
  if (value === null || value === undefined || value === '') {
    throw new Error(`Falta el campo obligatorio ${table}.${key} en los datos exportados.`);
  }
  return value;
}

function buildUserMap(authUsers, usuariosSat, tecnicos, movimientos) {
  const usedIds = new Set();
  for (const row of usuariosSat) {
    if (row.user_id) usedIds.add(row.user_id);
  }
  for (const row of tecnicos) {
    if (row.user_id) usedIds.add(row.user_id);
  }
  for (const row of movimientos) {
    if (row.creado_por) usedIds.add(row.creado_por);
  }

  const authById = new Map(authUsers.map((row) => [row.id, row]));
  const out = [];
  for (const userId of usedIds) {
    const row = authById.get(userId);
    if (!row) {
      throw new Error(`No existe auth.users.id=${userId} para un usuario referenciado.`);
    }
    if (!row.email) {
      throw new Error(`El usuario ${userId} no tiene email y no se puede migrar.`);
    }
    out.push(row);
  }
  out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return out;
}

function buildPasswordHash(row, tempPasswordHash) {
  if (row.encrypted_password) {
    return row.encrypted_password;
  }
  if (!tempPasswordHash) {
    throw new Error(
      `El usuario ${row.id} no tiene encrypted_password en Supabase. ` +
        'Define MIGRATION_TEMP_PASSWORD para migrarlo con contraseña temporal.',
    );
  }
  return tempPasswordHash;
}

async function main() {
  const [
    clientes,
    equipos,
    tecnicos,
    usuariosSat,
    inventarioMateriales,
    ordenesTrabajo,
    materialesOrden,
    inventarioMovimientos,
    ordenesTrabajoGps,
    authUsers,
  ] = await Promise.all([
    readJson('clientes.json'),
    readJson('equipos.json'),
    readJson('tecnicos.json'),
    readJson('usuarios_sat.json'),
    readJson('inventario_materiales.json'),
    readJson('ordenes_trabajo.json'),
    readJson('materiales_orden.json'),
    readJson('inventario_movimientos.json'),
    readJson('ordenes_trabajo_gps.json'),
    readJson('auth.users.json'),
  ]);

  const usuarios = buildUserMap(authUsers, usuariosSat, tecnicos, inventarioMovimientos);
  const tempPassword = (process.env.MIGRATION_TEMP_PASSWORD || '').trim();
  const tempPasswordHash = tempPassword
    ? bcrypt.hashSync(tempPassword, 10).replace(/^\$2b\$/, '$2y$')
    : '';
  const maxNumeroTicket = ordenesTrabajo.reduce((max, row) => {
    const ticket = Number(row.numero_ticket || 0);
    return Number.isFinite(ticket) && ticket > max ? ticket : max;
  }, 0);

  const chunks = [];
  chunks.push('-- Datos exportados desde Supabase para DonDominio');
  chunks.push(`-- Generado: ${new Date().toISOString()}`);
  chunks.push('SET NAMES utf8mb4;');
  chunks.push('SET foreign_key_checks = 0;');
  chunks.push('');
  chunks.push('DELETE FROM ordenes_trabajo_gps;');
  chunks.push('DELETE FROM inventario_movimientos;');
  chunks.push('DELETE FROM materiales_orden;');
  chunks.push('DELETE FROM ordenes_trabajo;');
  chunks.push('DELETE FROM inventario_materiales;');
  chunks.push('DELETE FROM equipos;');
  chunks.push('DELETE FROM tecnicos;');
  chunks.push('DELETE FROM usuarios_sat;');
  chunks.push('DELETE FROM usuarios;');
  chunks.push('DELETE FROM clientes;');
  chunks.push('');

  chunks.push(
    insertStatement(
      'usuarios',
      ['id', 'email', 'password_hash', 'mfa_secret', 'mfa_enabled', 'activo', 'created_at', 'updated_at'],
      usuarios,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'auth.users')),
        email: sqlValue(ensureRequired(row, 'email', 'auth.users')),
        password_hash: sqlValue(buildPasswordHash(row, tempPasswordHash)),
        mfa_secret: 'NULL',
        mfa_enabled: '0',
        activo: row.deleted_at || row.banned_until ? '0' : '1',
        created_at: sqlValue(row.created_at, { dateTime: true }),
        updated_at: sqlValue(row.updated_at, { dateTime: true }),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'usuarios_sat',
      ['user_id', 'rol', 'nombre_visible', 'creado_en'],
      usuariosSat,
      (row) => ({
        user_id: sqlValue(ensureRequired(row, 'user_id', 'usuarios_sat')),
        rol: sqlValue(ensureRequired(row, 'rol', 'usuarios_sat')),
        nombre_visible: sqlValue(row.nombre_visible),
        creado_en: sqlValue(row.creado_en, { dateTime: true }),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'clientes',
      ['id', 'nombre', 'direccion', 'telefono', 'email', 'lat', 'lng', 'created_at'],
      clientes,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'clientes')),
        nombre: sqlValue(ensureRequired(row, 'nombre', 'clientes')),
        direccion: sqlValue(row.direccion),
        telefono: sqlValue(row.telefono),
        email: sqlValue(row.email),
        lat: sqlValue(row.lat),
        lng: sqlValue(row.lng),
        created_at: sqlValue(row.created_at, { dateTime: true }),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'tecnicos',
      ['id', 'user_id', 'nombre', 'especialidad', 'activo'],
      tecnicos,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'tecnicos')),
        user_id: sqlValue(row.user_id),
        nombre: sqlValue(ensureRequired(row, 'nombre', 'tecnicos')),
        especialidad: sqlValue(row.especialidad),
        activo: sqlValue(row.activo),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'equipos',
      ['id', 'cliente_id', 'nombre', 'marca', 'modelo', 'numero_serie', 'ultima_revision'],
      equipos,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'equipos')),
        cliente_id: sqlValue(ensureRequired(row, 'cliente_id', 'equipos')),
        nombre: sqlValue(ensureRequired(row, 'nombre', 'equipos')),
        marca: sqlValue(row.marca),
        modelo: sqlValue(row.modelo),
        numero_serie: sqlValue(row.numero_serie),
        ultima_revision: sqlValue(row.ultima_revision, { dateOnly: true }),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'inventario_materiales',
      ['id', 'nombre', 'descripcion', 'unidad', 'stock_actual', 'precio_ref', 'activo', 'creado_en'],
      inventarioMateriales,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'inventario_materiales')),
        nombre: sqlValue(ensureRequired(row, 'nombre', 'inventario_materiales')),
        descripcion: sqlValue(row.descripcion),
        unidad: sqlValue(row.unidad),
        stock_actual: sqlValue(row.stock_actual),
        precio_ref: sqlValue(row.precio_ref),
        activo: sqlValue(row.activo),
        creado_en: sqlValue(row.creado_en, { dateTime: true }),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'ordenes_trabajo',
      [
        'id',
        'numero_ticket',
        'cliente_id',
        'equipo_id',
        'tecnico_id',
        'descripcion_averia',
        'tareas_realizadas',
        'tiempo_empleado_minutos',
        'mecanicos_intervinieron',
        'estado',
        'prioridad',
        'foto_url',
        'firma_url',
        'informe_pdf_url',
        'nombre_conformidad_cliente',
        'referencia_informe',
        'sin_intervencion',
        'origen_parte_imprevista',
        'fecha_inicio',
        'fecha_fin',
        'desplazamiento_inicio',
        'desplazamiento_fin',
        'desplazamiento_distancia_metros',
        'desplazamiento_distancia_factura_km',
        'intervension_inicio',
        'intervension_fin',
        'intervension_distancia_metros',
        'intervension_geo_inicio',
        'intervension_geo_fin',
        'localizacion_inicio',
        'localizacion_fin',
        'desplazamiento_lugar_inicio',
        'desplazamiento_lugar_fin',
        'intervension_lugar_inicio',
        'intervension_lugar_fin',
        'coste_materiales_editable',
        'tarifa_mano_obra_hora',
        'horas_mano_obra',
        'tarifa_desplazamiento_km',
        'km_desplazamiento_facturables',
        'recargo_festivo_pct',
        'recargo_fuera_horario_pct',
        'aplica_recargo_festivo',
        'aplica_recargo_fuera_horario',
        'coste_mano_obra_total',
        'coste_desplazamiento_total',
        'coste_total',
        'created_at',
        'updated_at',
      ],
      ordenesTrabajo,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'ordenes_trabajo')),
        numero_ticket: sqlValue(ensureRequired(row, 'numero_ticket', 'ordenes_trabajo')),
        cliente_id: sqlValue(ensureRequired(row, 'cliente_id', 'ordenes_trabajo')),
        equipo_id: sqlValue(row.equipo_id),
        tecnico_id: sqlValue(ensureRequired(row, 'tecnico_id', 'ordenes_trabajo')),
        descripcion_averia: sqlValue(ensureRequired(row, 'descripcion_averia', 'ordenes_trabajo')),
        tareas_realizadas: sqlValue(row.tareas_realizadas),
        tiempo_empleado_minutos: sqlValue(row.tiempo_empleado_minutos),
        mecanicos_intervinieron: sqlValue(row.mecanicos_intervinieron ?? 1),
        estado: sqlValue(row.estado),
        prioridad: sqlValue(row.prioridad),
        foto_url: sqlValue(row.foto_url),
        firma_url: sqlValue(row.firma_url),
        informe_pdf_url: sqlValue(row.informe_pdf_url),
        nombre_conformidad_cliente: sqlValue(row.nombre_conformidad_cliente),
        referencia_informe: sqlValue(row.referencia_informe),
        sin_intervencion: sqlValue(row.sin_intervencion),
        origen_parte_imprevista: sqlValue(row.origen_parte_imprevista),
        fecha_inicio: sqlValue(row.fecha_inicio, { dateTime: true }),
        fecha_fin: sqlValue(row.fecha_fin, { dateTime: true }),
        desplazamiento_inicio: sqlValue(row.desplazamiento_inicio, { dateTime: true }),
        desplazamiento_fin: sqlValue(row.desplazamiento_fin, { dateTime: true }),
        desplazamiento_distancia_metros: sqlValue(row.desplazamiento_distancia_metros),
        desplazamiento_distancia_factura_km: sqlValue(row.desplazamiento_distancia_factura_km),
        intervension_inicio: sqlValue(row.intervension_inicio, { dateTime: true }),
        intervension_fin: sqlValue(row.intervension_fin, { dateTime: true }),
        intervension_distancia_metros: sqlValue(row.intervension_distancia_metros),
        intervension_geo_inicio: sqlValue(row.intervension_geo_inicio),
        intervension_geo_fin: sqlValue(row.intervension_geo_fin),
        localizacion_inicio: sqlValue(row.localizacion_inicio ?? row.desplazamiento_lugar_inicio),
        localizacion_fin: sqlValue(row.localizacion_fin ?? row.desplazamiento_lugar_fin),
        desplazamiento_lugar_inicio: sqlValue(row.desplazamiento_lugar_inicio),
        desplazamiento_lugar_fin: sqlValue(row.desplazamiento_lugar_fin),
        intervension_lugar_inicio: sqlValue(row.intervension_lugar_inicio),
        intervension_lugar_fin: sqlValue(row.intervension_lugar_fin),
        coste_materiales_editable: sqlValue(row.coste_materiales_editable),
        tarifa_mano_obra_hora: sqlValue(row.tarifa_mano_obra_hora),
        horas_mano_obra: sqlValue(row.horas_mano_obra),
        tarifa_desplazamiento_km: sqlValue(row.tarifa_desplazamiento_km),
        km_desplazamiento_facturables: sqlValue(row.km_desplazamiento_facturables),
        recargo_festivo_pct: sqlValue(row.recargo_festivo_pct),
        recargo_fuera_horario_pct: sqlValue(row.recargo_fuera_horario_pct),
        aplica_recargo_festivo: sqlValue(row.aplica_recargo_festivo),
        aplica_recargo_fuera_horario: sqlValue(row.aplica_recargo_fuera_horario),
        coste_mano_obra_total: sqlValue(row.coste_mano_obra_total),
        coste_desplazamiento_total: sqlValue(row.coste_desplazamiento_total),
        coste_total: sqlValue(row.coste_total),
        created_at: sqlValue(row.created_at, { dateTime: true }),
        updated_at: sqlValue(row.updated_at, { dateTime: true }),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'materiales_orden',
      ['id', 'orden_id', 'material_id', 'nombre_material', 'cantidad', 'precio_unitario'],
      materialesOrden,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'materiales_orden')),
        orden_id: sqlValue(ensureRequired(row, 'orden_id', 'materiales_orden')),
        material_id: sqlValue(row.material_id),
        nombre_material: sqlValue(ensureRequired(row, 'nombre_material', 'materiales_orden')),
        cantidad: sqlValue(row.cantidad),
        precio_unitario: sqlValue(row.precio_unitario),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'inventario_movimientos',
      [
        'id',
        'material_id',
        'tipo_movimiento',
        'cantidad',
        'stock_anterior',
        'stock_nuevo',
        'motivo',
        'creado_por',
        'creado_en',
      ],
      inventarioMovimientos,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'inventario_movimientos')),
        material_id: sqlValue(ensureRequired(row, 'material_id', 'inventario_movimientos')),
        tipo_movimiento: sqlValue(ensureRequired(row, 'tipo_movimiento', 'inventario_movimientos')),
        cantidad: sqlValue(row.cantidad),
        stock_anterior: sqlValue(row.stock_anterior),
        stock_nuevo: sqlValue(row.stock_nuevo),
        motivo: sqlValue(row.motivo),
        creado_por: sqlValue(row.creado_por),
        creado_en: sqlValue(row.creado_en, { dateTime: true }),
      }),
    ),
  );

  chunks.push(
    insertStatement(
      'ordenes_trabajo_gps',
      ['id', 'orden_id', 'tecnico_id', 'lat', 'lng', 'accuracy_m', 'recorded_at', 'tipo', 'source', 'created_at'],
      ordenesTrabajoGps,
      (row) => ({
        id: sqlValue(ensureRequired(row, 'id', 'ordenes_trabajo_gps')),
        orden_id: sqlValue(ensureRequired(row, 'orden_id', 'ordenes_trabajo_gps')),
        tecnico_id: sqlValue(ensureRequired(row, 'tecnico_id', 'ordenes_trabajo_gps')),
        lat: sqlValue(row.lat),
        lng: sqlValue(row.lng),
        accuracy_m: sqlValue(row.accuracy_m),
        recorded_at: sqlValue(row.recorded_at, { dateTime: true }),
        tipo: sqlValue(row.tipo),
        source: sqlValue(row.source),
        created_at: sqlValue(row.created_at, { dateTime: true }),
      }),
    ),
  );

  if (maxNumeroTicket > 0) {
    chunks.push(`ALTER TABLE ordenes_trabajo AUTO_INCREMENT = ${maxNumeroTicket + 1};`);
  }
  chunks.push('SET foreign_key_checks = 1;');
  chunks.push('');

  await fs.writeFile(outputFile, `${chunks.join('\n')}\n`, 'utf8');
  console.log(`SQL generado en: ${outputFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
