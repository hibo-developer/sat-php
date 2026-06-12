# SAT para DonDominio (PHP + MySQL)

## Estructura final

La salida final para hosting compartido queda así:

```text
public_html/   -> frontend estático generado por Vite
api/           -> backend PHP
config/        -> conexión MySQL y variables de entorno
sql/           -> script SQL importable
```

## Cómo generar el paquete

Desde Windows/PowerShell:

```powershell
npm run build:hosting:pwsh
```

Eso crea una carpeta en `release/AAAA-MM-DD_HHMM_hosting/` con la estructura exacta para subir a DonDominio.

## Instalación en DonDominio

1. Crear una base de datos MySQL y un usuario con permisos.
2. Importar `sql/dondominio_mysql.sql`.
3. Subir el contenido de `release/*_hosting/` al hosting respetando esta estructura:
   - `public_html/`
   - `api/`
   - `config/`
   - `sql/`
4. Configurar las variables de entorno del hosting:
   - `SAT_DB_HOST`
   - `SAT_DB_PORT`
   - `SAT_DB_NAME`
   - `SAT_DB_USER`
   - `SAT_DB_PASSWORD`
   - `SAT_BASE_URL` por ejemplo `https://tudominio.com`
   - `SAT_ALLOWED_ORIGINS` opcional, por ejemplo `https://tudominio.com`
   - `SAT_SETUP_TOKEN` temporal para crear el admin inicial
5. Crear el usuario administrador inicial:
   - URL: `https://tudominio.com/api/setup/create_admin.php`
   - Header: `X-Setup-Token: <SAT_SETUP_TOKEN>`
   - Body JSON:

```json
{
  "email": "admin@tuempresa.com",
  "password": "UnaPasswordFuerte123",
  "nombre_visible": "Admin"
}
```

6. Eliminar o cambiar `SAT_SETUP_TOKEN` cuando el admin ya exista.

## Qué hace esta adaptación

- Sustituye Supabase Auth por autenticación PHP con sesión + CSRF.
- Sustituye PostgreSQL por MySQL.
- Sustituye Supabase Storage por almacenamiento local en `api/storage-data/`.
- Mantiene el frontend como SPA estática, pero desplegable en hosting compartido mediante `public_html/`.

## Notas

- Las referencias `sb://bucket/path` siguen existiendo en la app, pero ahora las resuelve la API PHP mediante `GET /api/storage/{bucket}/{path}`.
- `api/storage-data/` queda fuera del control de versiones salvo su `.gitignore`.
