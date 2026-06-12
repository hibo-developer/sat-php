import fs from 'node:fs/promises';
import path from 'node:path';

const TABLES_PUBLIC = [
  'clientes',
  'equipos',
  'tecnicos',
  'usuarios_sat',
  'inventario_materiales',
  'ordenes_trabajo',
  'materiales_orden',
  'inventario_movimientos',
  'ordenes_trabajo_gps',
];

const AUTH_USERS_SELECT = [
  'id',
  'email',
  'encrypted_password',
  'created_at',
  'updated_at',
  'email_confirmed_at',
  'last_sign_in_at',
  'banned_until',
  'is_anonymous',
  'deleted_at',
].join(',');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const outputDir =
  process.argv[2]?.trim() ||
  path.resolve(process.cwd(), 'migration-data', 'supabase-export');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. ' +
      'Define ambas variables antes de ejecutar el export.',
  );
  process.exit(1);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function requestJson(url, { schema = 'public', method = 'GET', body } = {}) {
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Profile': schema,
    'Content-Profile': schema,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error ${res.status} al consultar ${url}: ${text}`);
  }

  return res.json();
}

async function fetchAllRows({ schema, table, select = '*', orderBy = 'id', pageSize = 1000 }) {
  const rows = [];
  let offset = 0;

  for (;;) {
    const url =
      `${SUPABASE_URL}/rest/v1/${table}` +
      `?select=${encodeURIComponent(select)}` +
      `&order=${encodeURIComponent(orderBy)}` +
      `&limit=${pageSize}&offset=${offset}`;
    const batch = await requestJson(url, { schema });
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }
    rows.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return rows;
}

async function main() {
  await ensureDir(outputDir);

  const manifest = {
    exportedAt: new Date().toISOString(),
    projectUrl: SUPABASE_URL,
    files: [],
  };

  for (const table of TABLES_PUBLIC) {
    const rows = await fetchAllRows({ schema: 'public', table, select: '*', orderBy: 'id' });
    const fileName = `${table}.json`;
    await fs.writeFile(
      path.join(outputDir, fileName),
      `${JSON.stringify(rows, null, 2)}\n`,
      'utf8',
    );
    manifest.files.push({ schema: 'public', table, rows: rows.length, file: fileName });
    console.log(`Exportada ${table}: ${rows.length} filas`);
  }

  const authUsers = await fetchAllRows({
    schema: 'auth',
    table: 'users',
    select: AUTH_USERS_SELECT,
    orderBy: 'id',
  });
  await fs.writeFile(
    path.join(outputDir, 'auth.users.json'),
    `${JSON.stringify(authUsers, null, 2)}\n`,
    'utf8',
  );
  manifest.files.push({
    schema: 'auth',
    table: 'users',
    rows: authUsers.length,
    file: 'auth.users.json',
  });
  console.log(`Exportada auth.users: ${authUsers.length} filas`);

  await fs.writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.log(`Export completo en: ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
