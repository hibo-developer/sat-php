# SAT COTEPA para DonDominio

Versión adaptada del proyecto SAT para funcionar en **hosting compartido con PHP + MySQL**, manteniendo el frontend React/Vite como salida estática y sustituyendo la capa anterior basada en Supabase.

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
supabase/       Referencia histórica de la versión original
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
3. Subir el contenido del paquete respetando la estructura anterior.
4. Configurar las variables de entorno del backend.
5. Crear el admin inicial con `api/setup/create_admin.php`.

La guía paso a paso está en `DONDOMINIO.md`.

## Notas del repositorio

- La carpeta `supabase/` se conserva como referencia histórica de la app original.
- `api/storage-data/` almacena ficheros subidos en producción y queda fuera de Git.
- La rama/repositorio recomendado para esta migración es `sat-php`, dejando el repo original `sat` sin conflictos hasta el despliegue.
