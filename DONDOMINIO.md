# SAT para DonDominio (PHP + MySQL)

## Estructura del paquete

- `index.php`, `.htaccess`, `assets/`, `index.html`, etc.: frontend estático (salida de Vite) listo para `public_html/`
- `api/`: API PHP
- `config/`: configuración MySQL
- `sql/`: script MySQL importable

## Instalación en DonDominio

1. Crear una base de datos MySQL y un usuario con permisos sobre esa base de datos.
2. Importar el SQL: `sql/dondominio_mysql.sql`.
3. Subir el contenido del paquete generado (carpeta `release/*_hosting`) a `public_html/`.
4. Configurar variables de entorno en el hosting:
   - `SAT_DB_HOST`, `SAT_DB_PORT`, `SAT_DB_NAME`, `SAT_DB_USER`, `SAT_DB_PASSWORD`
   - `SAT_BASE_URL` (por ejemplo `https://tudominio.com`)
   - `SAT_ALLOWED_ORIGINS` (opcional, por ejemplo `https://tudominio.com`)
   - `SAT_SETUP_TOKEN` (temporal, solo para crear el admin inicial)
5. Crear el admin inicial:
   - POST `https://tudominio.com/api/setup/create_admin.php`
   - Header `X-Setup-Token: <SAT_SETUP_TOKEN>`
   - JSON `{ "email": "admin@tuempresa.com", "password": "UnaPasswordFuerte123", "nombre_visible": "Admin" }`
6. Borrar `SAT_SETUP_TOKEN` de la configuración (o cambiarlo) cuando el admin ya exista.

## Notas

- La autenticación es por sesión (cookie) + CSRF token.
- Las URLs `sb://bucket/path` se sirven vía `GET /api/storage/{bucket}/{path}` con control de acceso por rol.
