-- Verificacion post-migracion de seguridad
-- Ejecutar despues de 11_block_anonymous_sessions.sql
-- Objetivo: detectar politicas con posible acceso anonimo.

-- 1) Politicas en tablas de negocio que todavia incluyan roles anon/public.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'clientes',
    'equipos',
    'inventario_materiales',
    'materiales_orden',
    'ordenes_trabajo',
    'tecnicos',
    'usuarios_sat'
  )
  and (
    array_to_string(roles, ',') ilike '%anon%'
    or array_to_string(roles, ',') ilike '%public%'
  )
order by schemaname, tablename, policyname;

-- 2) Politicas de tablas de negocio para authenticated SIN guardia contra sesion anonima.
-- Debe devolver 0 filas cuando 11_block_anonymous_sessions.sql este aplicado correctamente.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'clientes',
    'equipos',
    'inventario_materiales',
    'materiales_orden',
    'ordenes_trabajo',
    'tecnicos',
    'usuarios_sat'
  )
  and array_to_string(roles, ',') ilike '%authenticated%'
  and coalesce(qual, '') not ilike '%fn_es_sesion_no_anon_sat%'
  and coalesce(with_check, '') not ilike '%fn_es_sesion_no_anon_sat%'
order by schemaname, tablename, policyname;

-- 3) Politicas en storage.objects con anon/public o sin guardia no anon.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    array_to_string(roles, ',') ilike '%anon%'
    or array_to_string(roles, ',') ilike '%public%'
    or (
      array_to_string(roles, ',') ilike '%authenticated%'
      and coalesce(qual, '') not ilike '%fn_es_sesion_no_anon_sat%'
      and coalesce(with_check, '') not ilike '%fn_es_sesion_no_anon_sat%'
    )
  )
order by policyname;

-- 4) Confirmacion de existencia de la funcion guardia.
select
  n.nspname as schema,
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'fn_es_sesion_no_anon_sat';

-- 5) Resultado resumido esperado:
-- - Bloque 1: 0 filas
-- - Bloque 2: 0 filas
-- - Bloque 3: 0 filas
-- - Bloque 4: 1 fila
