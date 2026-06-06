# SAT Móvil COTEPA — React + Vite + Supabase

Aplicación de gestión de Servicio de Asistencia Técnica (SAT) con soporte **web**, **desktop (Electron)** y **móvil (Android/Capacitor)**. Gestiona órdenes de trabajo, partes de trabajo, inventario de materiales, clientes y equipos, con roles diferenciados (`admin`, `oficina`, `tecnico`), firma digital del cliente, generación de informes PDF, exportaciones Excel/ZIP y **soporte offline-first** mediante Dexie (IndexedDB).

---

## Funcionalidades actuales

| Módulo | Descripción |
|---|---|
| Órdenes de trabajo | Alta, edición, cierre y seguimiento de estados (`pendiente`, `en_proceso`, `pausado`, `cerrada`) |
| Parte de trabajo | Registro de desplazamiento, intervención, materiales usados, firma del cliente y fotos |
| Informes PDF | Generación automática y subida a Supabase Storage al cerrar un parte |
| Inventario | Control de stock de materiales con descuento al usar en partes |
| Clientes & Equipos | CRUD completo con búsqueda y vinculación a órdenes |
| Exportaciones | Descarga de órdenes en Excel y ZIP con adjuntos |
| Roles y seguridad | RLS en Supabase, políticas por rol, bloqueo de sesiones anónimas |
| Offline-first | Cola de mutaciones y partes pendientes en IndexedDB, sincronización automática al recuperar red |
| Admin | Gestión de usuarios, asignación de roles vía Edge Functions |

---

## Plataformas de distribución

- **Web**: despliegue estático (cualquier CDN / hosting)
- **Desktop**: instalador `.exe` (NSIS) y portable via Electron Builder
- **Android**: APK / AAB via Capacitor + Gradle

---

## Requisitos

- Node.js 20+
- Proyecto Supabase operativo (PostgreSQL + Auth + Storage + Edge Functions)
- Para Android: Android Studio + JDK 17+

---

## Arranque rápido

```bash
npm install
npm run dev
```

PowerShell (entorno Windows del proyecto):

```powershell
npm run dev:pwsh
```

Build web:

```powershell
npm run build:pwsh
```

---

## Scripts clave

| Script | Descripción |
|---|---|
| `npm run build:pwsh` | Compila frontend |
| `npm run build:desktop:pwsh` | Empaqueta instalador Windows (NSIS) |
| `npm run build:desktop:portable:pwsh` | Empaqueta versión portable |
| `npm run build:apk:pwsh` | Build APK Android |
| `npm run preflight:prod:pwsh` | Valida prerequisitos de salida a producción |
| `npm run release:check:pwsh` | Build + preflight de producción |

---

## Variables de entorno

1. Copia `.env.example` a `.env`.
2. Define:

```env
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

> El flujo de informes usa Supabase Storage para almacenar PDFs. No hay envío automático de correo integrado (disponible como Edge Function `send-sat-email` preparada pero no activada por defecto).

---

## Base de datos y seguridad

### Migraciones versionadas (orden en Supabase SQL Editor)

1. `supabase/migrations/20260423000000_create_schema_sat.sql`
2. `supabase/migrations/20260423100000_seed_data.sql` *(solo pruebas)*
3. `supabase/migrations/20260423200000_storage_buckets.sql`
4. `supabase/migrations/20260606000000_add_updated_at_ordenes_trabajo.sql`
5. `supabase/migrations/20260606010000_add_client_coords_and_gps_history.sql`
6. `supabase/migrations/20260501000000_security_hardening_block_anon.sql`
7. `supabase/migrations/20260501010000_lint_fixes_security.sql`
8. `supabase/migrations/20260501020000_lint_perf_initplan_and_multiple_permissive.sql`
9. `supabase/migrations/20260501030000_fk_covering_indexes.sql`
10. `supabase/migrations/20260501040000_drop_redundant_deny_anonymous.sql`
11. `supabase/migrations/20260501050000_move_security_definer_to_private_schema.sql`
12. `supabase/migrations/20260501060000_storage_select_policies.sql`

### Scripts legacy (referencia, no ejecutar si ya se aplicaron las migraciones)

`supabase/01_schema_sat.sql` → `supabase/13_apply_and_verify_security.sql`

Documentación de validación: `docs/checklist-validacion-roles.md` y `docs/checklist-validacion-seguridad-supabase.md`.

---

## Producción (go-live)

1. Ejecuta `npm run release:check:pwsh`.
2. Verifica acceso real por rol (`admin`, `oficina`, `tecnico`).
3. Valida login/logout, alta/edición/cierre de órdenes y descarga de informes.
4. Verifica exportaciones Excel/ZIP con datos reales.
5. Ejecuta checklist de `docs/checklist-produccion.md`.

---

## Offline-first (producción)

- Cola de mutaciones en `pending_actions` con **deduplicación por OT** (si editas varias veces la misma OT offline, se consolida).
- Procesado automático con **reintentos y backoff** al recuperar conexión.
- Conflictos “oficina vs técnico” resueltos por **timestamp (updated_at vs clientUpdatedAt)** y registro en `sync_conflicts` (IndexedDB).
- Requisito: aplicar la migración `20260606000000_add_updated_at_ordenes_trabajo.sql` para habilitar `updated_at`.
- Tracking: aplicar `20260606010000_add_client_coords_and_gps_history.sql` para guardar coordenadas de clientes y el histórico GPS por OT.

### Tracking en segundo plano (Android)

- La app puede iniciar un **foreground service** para registrar puntos GPS cada 5 min aunque la app quede en segundo plano.
- Los puntos se guardan localmente y se vuelcan a la cola `pending_gps` cuando la app vuelve al primer plano o hay conexión.

### Android release (keystore)

- Define `KEYSTORE_PASSWORD` y `KEY_PASSWORD` como variables de entorno para generar releases firmadas (no se guardan en el repo).

### Checklist QA (offline/sync)

- Editar OT con el móvil sin conexión → aparece “Cambios pendientes de sincronizar” y al volver internet se sincroniza solo.
- Editar OT offline (técnico) y editar la misma OT online desde oficina → al volver internet, verificar que gana el último timestamp y que se registra conflicto.
- Cerrar parte offline (fotos + firma) → se encola y se envía al reconectar.
- Forzar cierre de la app con cambios pendientes → reabrir con internet y comprobar que se drena la cola.

---

## Tests

```bash
npm test
```

---

## Estructura principal

```
src/
  views/         # Pantallas: AccesoView, ListaOrdenesView, ParteTrabajoView,
                 #            ClientesView, InventarioView, AdminView
  services/      # Acceso a Supabase y lógica SAT (órdenes, partes, inventario,
                 #            clientes, equipos, auth, offline, PDF...)
  hooks/         # useOrdenes, useAuthSession, useDebounce
  components/    # NavbarInferior, ToastEstado, IndicadorSync, CambiarPasswordModal
scripts/         # Automatizaciones PowerShell de build y verificación
supabase/        # SQL de esquema, roles, hardening, storage y migraciones
electron/        # Main process, preload y afterPack para la app desktop
android/         # Proyecto Capacitor/Gradle para Android
```

---

## Integración con Power Apps

El backend en **Supabase expone una API REST estándar (PostgREST)** y soporta autenticación JWT, lo que permite conectar Power Apps al mismo origen de datos sin duplicar la base de datos.

### Qué se puede hacer hoy

| Caso de uso | Mecanismo |
|---|---|
| **Leer órdenes de trabajo** desde Power Apps | Conector HTTP personalizado → `GET {SUPABASE_URL}/rest/v1/ordenes_trabajo` con header `apikey` + `Authorization: Bearer <token>` |
| **Crear / actualizar órdenes** | Conector HTTP → `POST` / `PATCH` al mismo endpoint |
| **Consultar clientes y equipos** | Igual, endpoints `/rest/v1/clientes` y `/rest/v1/equipos` |
| **Ver inventario de materiales** | Endpoint `/rest/v1/materiales` |
| **Disparar notificaciones o correo** | Power Automate → llama a la Edge Function `send-sat-email` via HTTP |
| **Descargar PDF de un parte** | Power Automate descarga desde Supabase Storage (`/storage/v1/object/informes-partes/<ruta>`) |

### Pasos para conectar Power Apps

1. En Supabase → **Settings → API**: copia `Project URL` y `anon key`.
2. En Power Apps → **Conectores personalizados** → nuevo conector desde URL OpenAPI o manual.
   - Host: `<proyecto>.supabase.co`
   - Autenticación: API Key en header (`apikey`) + `Authorization: Bearer <service_role_key>` para acceso de solo lectura seguro desde un flujo de Power Automate (no exponer `service_role` en cliente final; usar `anon` + políticas RLS).
3. Crear un **flujo de Power Automate** intermediario si se necesita lógica de transformación o seguridad adicional antes de llegar a Power Apps.
4. Las tablas ya tienen **RLS activo**: cualquier petición con `anon key` respeta los permisos del rol `anon` (actualmente bloqueado); usar un JWT de usuario real o el `service_role` solo en flujos de backend.

### Limitaciones actuales

- La firma del cliente y las fotos de intervención se almacenan en Supabase Storage; Power Apps puede leer las URLs públicas pero no el canvas de firma directamente.
- El modo offline (Dexie/IndexedDB) es exclusivo de la app React; Power Apps no tiene acceso a esa cola local.
- La generación del PDF de informe requiere la lógica JS (`jsPDF`) de la app React; desde Power Apps se puede descargar el PDF ya generado, pero no regenerarlo sin invocar la app o una Edge Function dedicada.

---

## Hoja de ruta sugerida para integración Power Apps

1. **Corto plazo**: conector de solo lectura (listas de órdenes, clientes) para dashboards Power BI / Power Apps.
2. **Medio plazo**: formulario Power Apps para que oficina cree/edite órdenes sin necesidad de la app React.
3. **Largo plazo**: Edge Function `generate-pdf` en Supabase para que Power Automate pueda regenerar informes PDF sin depender del frontend React.
