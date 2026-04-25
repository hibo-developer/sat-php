# SAT Movil (React + Vite + Supabase)

Aplicacion web/desktop para gestion SAT con roles (`admin`, `oficina`, `tecnico`), partes de trabajo, informe PDF y exportaciones profesionales (Excel/ZIP).

## Requisitos

- Node.js 20+
- Proyecto Supabase operativo

## Arranque rapido

```bash
npm install
npm run dev
```

PowerShell (entorno Windows del proyecto):

```powershell
npm run dev:pwsh
```

Build:

```powershell
npm run build:pwsh
```

## Scripts clave

- `npm run build:pwsh`: compila frontend
- `npm run build:desktop:pwsh`: empaqueta app desktop
- `npm run build:apk:pwsh`: build APK
- `npm run preflight:prod:pwsh`: valida prerequisitos de salida a produccion
- `npm run release:check:pwsh`: build + preflight de produccion

## Variables de entorno

1. Copia `.env.example` a `.env`.
2. Define:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nota: el flujo actual de informes es almacenamiento y descarga de PDF desde Supabase Storage (sin envio automatico de correo).

## Base de datos y seguridad

Orden recomendado en Supabase SQL Editor:

1. `supabase/01_schema_sat.sql`
2. `supabase/02_seed_sat.sql` (solo pruebas)
3. `supabase/03_add_tiempo_empleado_minutos.sql`
4. `supabase/04_security_roles_rls.sql`
5. `supabase/05_asignacion_roles_usuarios.sql`
6. `supabase/06_storage_firmas_clientes.sql`
7. `supabase/07_storage_informes_partes.sql`
8. `supabase/08_inventario_materiales.sql`
9. `supabase/09_storage_fotos_intervenciones.sql`
10. `supabase/10_security_hardening.sql`
11. `supabase/11_block_anonymous_sessions.sql`
12. `supabase/12_verify_no_anonymous_policies.sql` (solo verificacion, no modifica datos)

Alternativa todo-en-uno para seguridad y verificacion:

- `supabase/13_apply_and_verify_security.sql` (aplica hardening + bloqueo anonimo + verificaciones en una sola ejecucion)

Referencia de validacion por roles:

- `docs/checklist-validacion-roles.md`

## Produccion (go-live)

Antes de publicar:

1. Ejecuta `npm run release:check:pwsh`.
2. Verifica acceso real por rol (`admin`, `oficina`, `tecnico`).
3. Valida login/logout, alta/edicion/cierre de ordenes y descarga de informes.
4. Verifica exportaciones Excel/ZIP con datos reales.
5. Ejecuta checklist de `docs/checklist-produccion.md`.

## Estructura principal

- `src/views`: pantallas (`Acceso`, `Ordenes`, `Parte`, `Clientes`, `Admin`)
- `src/services`: acceso a Supabase y logica SAT
- `src/hooks`: estado y reglas de negocio
- `scripts`: automatizaciones de build y verificacion
- `supabase`: SQL de esquema, roles, hardening y storage
