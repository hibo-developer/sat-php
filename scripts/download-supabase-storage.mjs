import fs from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const outputDir =
  process.argv[2]?.trim() || path.resolve(process.cwd(), 'migration-data', 'storage-export');
const buckets = process.argv.slice(3).filter(Boolean).length
  ? process.argv.slice(3).filter(Boolean)
  : ['firmas-clientes', 'fotos-intervenciones', 'informes-partes'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. ' +
      'Define ambas variables antes de descargar Storage.',
  );
  process.exit(1);
}

function authHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listFolder(bucket, prefix = '') {
  const url = `${SUPABASE_URL}/storage/v1/object/list/${bucket}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`No se pudo listar ${bucket}/${prefix}: ${res.status} ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function downloadObject(bucket, objectPath) {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(url, {
      headers: authHeaders(),
    });

    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }

    const text = await res.text().catch(() => '');
    lastError = new Error(`No se pudo descargar ${bucket}/${objectPath}: ${res.status} ${text}`);
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError;
}

function isFolder(item) {
  return !item?.id && !item?.metadata;
}

async function walkBucket(bucket, prefix = '', found = []) {
  const items = await listFolder(bucket, prefix);
  for (const item of items) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const nextPath = prefix ? `${prefix}/${name}` : name;
    if (isFolder(item)) {
      await walkBucket(bucket, nextPath, found);
    } else {
      found.push(nextPath);
    }
  }
  return found;
}

async function main() {
  await ensureDir(outputDir);

  for (const bucket of buckets) {
    const objectPaths = await walkBucket(bucket);
    const bucketDir = path.join(outputDir, bucket);
    await ensureDir(bucketDir);
    console.log(`Bucket ${bucket}: ${objectPaths.length} objetos`);

    for (const objectPath of objectPaths) {
      const fileBuffer = await downloadObject(bucket, objectPath);
      const targetPath = path.join(bucketDir, ...objectPath.split('/'));
      await ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, fileBuffer);
      console.log(`  descargado ${bucket}/${objectPath}`);
    }
  }

  console.log(`Descarga completada en: ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
