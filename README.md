# SAT COTEPA para DonDominio

Aplicación SAT adaptada para **hosting compartido con PHP + MySQL**, con frontend React/Vite compilado como sitio estático y backend propio en PHP.

## Arquitectura actual

- `public_html/` contiene el frontend estático listo para subir al hosting.
- `public_html/api/` contiene la entrada web a la API (proxy PHP hacia `api/`).
- `api/` contiene el backend en PHP (fuera de `public_html`).
- `config/` contiene la configuración de conexión MySQL.
- `sql/` contiene el script final de importación para MySQL.

## Qué incluye

- Gestión de órdenes de trabajo.
- Registro y edición de partes.
- Gestión de clientes, equipos y técnicos.
- Inventario con movimientos y regularización.
- Usuarios con roles `admin`, `oficina` y `tecnico`.
- Firma del cliente, fotos e informes PDF guardados por la API PHP.
- Soporte offline-first en el frontend con Dexie/IndexedDB.

## Estructura del repo

```text
api/            Backend PHP
config/         Configuración MySQL
public/         Recursos públicos del frontend
public_html/    Carpeta reservada para la salida final del hosting
sql/            SQL importable en DonDominio
src/            Frontend React/Vite
scripts/        Automatizaciones PowerShell
docs/           Guías operativas
```

## Desarrollo del frontend

Requisitos:

- Node.js 20+

Comandos principales:

```bash
npm install
npm run dev
npm test
```

PowerShell:

```powershell
npm run dev:pwsh
npm run build:hosting:pwsh
```

## Configuración de producción

Frontend:

- `public/app-config.js`
- `API_BASE_URL: '/api'`

Backend PHP:

- `SAT_DB_HOST`
- `SAT_DB_PORT`
- `SAT_DB_NAME`
- `SAT_DB_USER`
- `SAT_DB_PASSWORD`
- `SAT_BASE_URL`
- `SAT_ALLOWED_ORIGINS` opcional
- `SAT_LOGIN_LIMIT_IP_ATTEMPTS` opcional
- `SAT_LOGIN_LIMIT_EMAIL_ATTEMPTS` opcional
- `SAT_LOGIN_LIMIT_WINDOW_SECONDS` opcional
- `SAT_LOGIN_LIMIT_BLOCK_SECONDS` opcional
- `SAT_SETUP_ENABLED` opcional
- `SAT_SETUP_TOKEN` temporal para crear el admin inicial

## Empaquetado para DonDominio

Generar paquete:

```powershell
npm run build:hosting:pwsh
```

La salida se crea en `release/<fecha>_hosting/` con esta forma:

```text
release/<fecha>_hosting/
  public_html/
    api/
  api/
  config/
  sql/
  DONDOMINIO.md
```

## Instalación en el hosting

1. Crear la base de datos MySQL.
2. Importar `sql/dondominio_mysql.sql`.
3. Si la instalación ya existe, importar también `sql/security_rate_limit.sql`.
4. Subir el contenido del paquete respetando la estructura anterior.
5. Configurar las variables de entorno del backend.
6. Crear el admin inicial con `api/setup/create_admin.php` solo con `SAT_SETUP_ENABLED=true`.

La guía paso a paso está en `DONDOMINIO.md` y la operativa de seguridad/logs en `docs/seguridad-operativa.md`.

## Migracion de datos

Si quieres mover los datos reales desde la instalación anterior:

- `npm run migrate:supabase:export`
- `npm run migrate:supabase:storage`
- `npm run migrate:mysql:seed`

La guia completa está en `docs/migracion-supabase-dondominio.md`.

## Notas del repositorio

- `api/storage-data/` almacena ficheros subidos en producción y queda fuera de Git.
- La rama/repositorio recomendado para esta migración es `sat-php`, dejando el repo original `sat` sin conflictos hasta el despliegue.
