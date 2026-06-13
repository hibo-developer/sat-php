import fs from 'node:fs/promises';
import path from 'node:path';

const TABLES_PUBLIC = [
  { table: 'clientes', orderBy: 'id' },
  { table: 'equipos', orderBy: 'id' },
  { table: 'tecnicos', orderBy: 'id' },
  { table: 'usuarios_sat', orderBy: 'user_id' },
  { table: 'inventario_materiales', orderBy: 'id' },
  { table: 'ordenes_trabajo', orderBy: 'id' },
  { table: 'materiales_orden', orderBy: 'id' },
  { table: 'inventario_movimientos', orderBy: 'id' },
  { table: 'ordenes_trabajo_gps', orderBy: 'id' },
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

async function fetchAdminUsers({ pageSize = 100 } = {}) {
  const rows = [];
  let page = 1;

  for (;;) {
    const url = `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Error ${res.status} al consultar ${url}: ${text}`);
    }

    const data = await res.json();
    const batch = Array.isArray(data?.users) ? data.users : [];
    if (batch.length === 0) {
      break;
    }

    rows.push(
      ...batch.map((row) => ({
        id: row.id ?? null,
        email: row.email ?? null,
        encrypted_password: null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        email_confirmed_at: row.email_confirmed_at ?? row.confirmed_at ?? null,
        last_sign_in_at: row.last_sign_in_at ?? null,
        banned_until: row.banned_until ?? null,
        is_anonymous: row.is_anonymous ?? false,
        deleted_at: row.deleted_at ?? null,
      })),
    );

    if (batch.length < pageSize) {
      break;
    }
    page += 1;
  }

  rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return rows;
}

async function main() {
  await ensureDir(outputDir);

  const manifest = {
    exportedAt: new Date().toISOString(),
    projectUrl: SUPABASE_URL,
    files: [],
  };

  for (const { table, orderBy } of TABLES_PUBLIC) {
    const rows = await fetchAllRows({ schema: 'public', table, select: '*', orderBy });
    const fileName = `${table}.json`;
    await fs.writeFile(
      path.join(outputDir, fileName),
      `${JSON.stringify(rows, null, 2)}\n`,
      'utf8',
    );
    manifest.files.push({ schema: 'public', table, rows: rows.length, file: fileName });
    console.log(`Exportada ${table}: ${rows.length} filas`);
  }

  const authUsers = await fetchAdminUsers();
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
