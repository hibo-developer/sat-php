-- Ajustes para eliminar lints:
-- - 0028/0029: SECURITY DEFINER ejecutable por anon/authenticated (fn_es_sesion_no_anon_sat)
-- - 0012: policies aplican a sesiones anon (auth.jwt().is_anonymous)

create or replace function public.fn_es_sesion_no_anon_sat()
returns boolean
language sql
stable
security invoker
set search_path = public, auth
as $$
  select
    auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

revoke execute on function public.fn_es_sesion_no_anon_sat() from anon, public;
grant execute on function public.fn_es_sesion_no_anon_sat() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'public.usuarios_sat',
    'public.clientes',
    'public.equipos',
    'public.tecnicos',
    'public.ordenes_trabajo',
    'public.materiales_orden'
  ] loop
    execute format('drop policy if exists "deny_anonymous_sat" on %s', t);
    execute format($f$
      create policy "deny_anonymous_sat"
      on %s
      as restrictive
      for all
      to authenticated
      using      (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
      with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
    $f$, t);
  end loop;
end
$$;

do $$
begin
  if to_regclass('public.inventario_materiales') is not null then
    execute 'alter table public.inventario_materiales enable row level security';
    execute 'drop policy if exists "deny_anonymous_sat" on public.inventario_materiales';
    execute $f$
      create policy "deny_anonymous_sat"
      on public.inventario_materiales
      as restrictive
      for all
      to authenticated
      using      (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
      with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
    $f$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.inventario_movimientos') is not null then
    execute 'alter table public.inventario_movimientos enable row level security';
    execute 'drop policy if exists "deny_anonymous_sat" on public.inventario_movimientos';
    execute $f$
      create policy "deny_anonymous_sat"
      on public.inventario_movimientos
      as restrictive
      for all
      to authenticated
      using      (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
      with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
    $f$;
  end if;
end
$$;

-- Storage: evitar que sesiones anónimas (is_anonymous=true) puedan escribir/borrar.
-- Nota: el linter 0012 se fija en policies aplicables a authenticated; por eso
-- se añade explícitamente el check is_anonymous=false en USING/WITH CHECK.

-- firmas-clientes
drop policy if exists "auth_insert_firmas_clientes" on storage.objects;
create policy "auth_insert_firmas_clientes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'firmas-clientes'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "auth_update_firmas_clientes" on storage.objects;
create policy "auth_update_firmas_clientes"
on storage.objects for update to authenticated
using (
  bucket_id = 'firmas-clientes'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
)
with check (
  bucket_id = 'firmas-clientes'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "auth_delete_firmas_clientes" on storage.objects;
create policy "auth_delete_firmas_clientes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'firmas-clientes'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- fotos-intervenciones
drop policy if exists "auth_insert_fotos_intervenciones" on storage.objects;
create policy "auth_insert_fotos_intervenciones"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'fotos-intervenciones'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "auth_update_fotos_intervenciones" on storage.objects;
create policy "auth_update_fotos_intervenciones"
on storage.objects for update to authenticated
using (
  bucket_id = 'fotos-intervenciones'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
)
with check (
  bucket_id = 'fotos-intervenciones'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "auth_delete_fotos_intervenciones" on storage.objects;
create policy "auth_delete_fotos_intervenciones"
on storage.objects for delete to authenticated
using (
  bucket_id = 'fotos-intervenciones'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- informes-partes
drop policy if exists "auth_insert_informes_partes" on storage.objects;
create policy "auth_insert_informes_partes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'informes-partes'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "auth_update_informes_partes" on storage.objects;
create policy "auth_update_informes_partes"
on storage.objects for update to authenticated
using (
  bucket_id = 'informes-partes'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
)
with check (
  bucket_id = 'informes-partes'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "auth_delete_informes_partes" on storage.objects;
create policy "auth_delete_informes_partes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'informes-partes'
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
