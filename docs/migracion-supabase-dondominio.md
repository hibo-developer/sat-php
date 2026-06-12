# Migracion de datos: Supabase -> DonDominio

Esta guia mueve datos reales desde Supabase hacia la version PHP + MySQL.

## 1. Exportar datos de tablas

Define estas variables en la terminal:

```powershell
$env:SUPABASE_URL="https://TU-PROYECTO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
```

Ejecuta:

```powershell
npm run migrate:supabase:export
```

Salida esperada:

- `migration-data/supabase-export/clientes.json`
- `migration-data/supabase-export/equipos.json`
- `migration-data/supabase-export/tecnicos.json`
- `migration-data/supabase-export/usuarios_sat.json`
- `migration-data/supabase-export/inventario_materiales.json`
- `migration-data/supabase-export/ordenes_trabajo.json`
- `migration-data/supabase-export/materiales_orden.json`
- `migration-data/supabase-export/inventario_movimientos.json`
- `migration-data/supabase-export/ordenes_trabajo_gps.json`
- `migration-data/supabase-export/auth.users.json`

## 2. Descargar archivos de Storage

```powershell
npm run migrate:supabase:storage
```

Esto intenta descargar los buckets:

- `firmas-clientes`
- `fotos-intervenciones`
- `informes-partes`

Salida esperada:

- `migration-data/storage-export/firmas-clientes/...`
- `migration-data/storage-export/fotos-intervenciones/...`
- `migration-data/storage-export/informes-partes/...`

Luego copia ese contenido a:

- `api/storage-data/firmas-clientes/...`
- `api/storage-data/fotos-intervenciones/...`
- `api/storage-data/informes-partes/...`

## 3. Generar el SQL de datos para MySQL

```powershell
npm run migrate:mysql:seed
```

Se genera:

- `sql/dondominio_data_seed.sql`

Este archivo:

- inserta usuarios con el mismo `id` de `auth.users`
- reutiliza `encrypted_password` como `password_hash`
- inserta roles de `usuarios_sat`
- inserta clientes, equipos, tecnicos, inventario, ordenes, materiales y GPS
- ajusta el `AUTO_INCREMENT` de `numero_ticket`

## 4. Importar en DonDominio

Orden recomendado:

1. Importar `sql/dondominio_mysql.sql`
2. Importar `sql/dondominio_data_seed.sql`
3. Copiar los ficheros descargados de Storage a `api/storage-data/`
4. Subir el proyecto empaquetado al hosting

## 5. Verificaciones

- Login con un usuario real ya existente en Supabase
- Acceso correcto por rol `admin`, `oficina` y `tecnico`
- Apertura de firmas, fotos y PDFs desde `/api/storage/...`
- Integridad de OT, materiales y stock

## Notas

- El export usa `SUPABASE_SERVICE_ROLE_KEY`, por lo que debes ejecutarlo en una maquina segura.
- `migration-data/` esta ignorado por Git para no subir datos reales.
- Si algun usuario de `auth.users` no tiene `encrypted_password`, el generador de SQL se detiene para que lo resuelvas manualmente.
