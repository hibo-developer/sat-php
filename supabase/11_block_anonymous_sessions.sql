-- Bloquear sesiones anonimas en politicas RLS y Storage
-- Ejecutar despues de 10_security_hardening.sql

create or replace function public.fn_es_sesion_no_anon_sat()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

revoke all on function public.fn_es_sesion_no_anon_sat() from public;
grant execute on function public.fn_es_sesion_no_anon_sat() to authenticated;

-- Tablas negocio

drop policy if exists "usuarios_sat_read_self" on public.usuarios_sat;
create policy "usuarios_sat_read_self"
on public.usuarios_sat
for select
to authenticated
using (public.fn_es_sesion_no_anon_sat() and (user_id = auth.uid() or public.fn_es_admin_sat()));

drop policy if exists "usuarios_sat_admin_manage" on public.usuarios_sat;
create policy "usuarios_sat_admin_manage"
on public.usuarios_sat
for all
to authenticated
using (public.fn_es_sesion_no_anon_sat() and public.fn_es_admin_sat())
with check (public.fn_es_sesion_no_anon_sat() and public.fn_es_admin_sat());

drop policy if exists "clientes_select" on public.clientes;
create policy "clientes_select"
on public.clientes
for select
to authenticated
using (public.fn_es_sesion_no_anon_sat());

drop policy if exists "clientes_write_oficina_admin" on public.clientes;
create policy "clientes_write_oficina_admin"
on public.clientes
for all
to authenticated
using (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat())
with check (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat());

drop policy if exists "equipos_select" on public.equipos;
create policy "equipos_select"
on public.equipos
for select
to authenticated
using (public.fn_es_sesion_no_anon_sat());

drop policy if exists "equipos_write_oficina_admin" on public.equipos;
create policy "equipos_write_oficina_admin"
on public.equipos
for all
to authenticated
using (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat())
with check (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat());

drop policy if exists "tecnicos_select" on public.tecnicos;
create policy "tecnicos_select"
on public.tecnicos
for select
to authenticated
using (public.fn_es_sesion_no_anon_sat());

drop policy if exists "tecnicos_write_oficina_admin" on public.tecnicos;
create policy "tecnicos_write_oficina_admin"
on public.tecnicos
for all
to authenticated
using (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat())
with check (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat());

drop policy if exists "ordenes_select" on public.ordenes_trabajo;
create policy "ordenes_select"
on public.ordenes_trabajo
for select
to authenticated
using (
  public.fn_es_sesion_no_anon_sat()
  and (
    public.fn_es_oficina_o_admin_sat()
    or public.fn_es_tecnico_de_orden_sat(id)
  )
);

drop policy if exists "ordenes_update_oficina_admin" on public.ordenes_trabajo;
create policy "ordenes_update_oficina_admin"
on public.ordenes_trabajo
for update
to authenticated
using (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat())
with check (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat());

drop policy if exists "ordenes_update_tecnico_propias" on public.ordenes_trabajo;
create policy "ordenes_update_tecnico_propias"
on public.ordenes_trabajo
for update
to authenticated
using (public.fn_es_sesion_no_anon_sat() and public.fn_es_tecnico_de_orden_sat(id))
with check (public.fn_es_sesion_no_anon_sat() and public.fn_es_tecnico_de_orden_sat(id));

drop policy if exists "materiales_select" on public.materiales_orden;
create policy "materiales_select"
on public.materiales_orden
for select
to authenticated
using (
  public.fn_es_sesion_no_anon_sat()
  and (
    public.fn_es_oficina_o_admin_sat()
    or public.fn_es_tecnico_de_orden_sat(orden_id)
  )
);

drop policy if exists "materiales_write_oficina_admin" on public.materiales_orden;
create policy "materiales_write_oficina_admin"
on public.materiales_orden
for all
to authenticated
using (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat())
with check (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat());

drop policy if exists "inventario_materiales_select" on public.inventario_materiales;
create policy "inventario_materiales_select"
on public.inventario_materiales
for select
to authenticated
using (public.fn_es_sesion_no_anon_sat());

drop policy if exists "inventario_materiales_write_oficina_admin" on public.inventario_materiales;
create policy "inventario_materiales_write_oficina_admin"
on public.inventario_materiales
for all
to authenticated
using (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat())
with check (public.fn_es_sesion_no_anon_sat() and public.fn_es_oficina_o_admin_sat());

-- Storage: quitar anonimo tambien en escritura

-- Firmas clientes

drop policy if exists "dev_public_insert_firmas_clientes" on storage.objects;
drop policy if exists "dev_public_update_firmas_clientes" on storage.objects;
drop policy if exists "dev_public_delete_firmas_clientes" on storage.objects;

drop policy if exists "auth_insert_firmas_clientes" on storage.objects;
create policy "auth_insert_firmas_clientes"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'firmas-clientes'
  and public.fn_es_sesion_no_anon_sat()
);

drop policy if exists "auth_update_firmas_clientes" on storage.objects;
create policy "auth_update_firmas_clientes"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'firmas-clientes'
  and public.fn_es_sesion_no_anon_sat()
)
with check (
  bucket_id = 'firmas-clientes'
  and public.fn_es_sesion_no_anon_sat()
);

drop policy if exists "auth_delete_firmas_clientes" on storage.objects;
create policy "auth_delete_firmas_clientes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'firmas-clientes'
  and public.fn_es_sesion_no_anon_sat()
);

-- Fotos intervenciones

drop policy if exists "dev_public_insert_fotos_intervenciones" on storage.objects;
drop policy if exists "dev_public_update_fotos_intervenciones" on storage.objects;
drop policy if exists "dev_public_delete_fotos_intervenciones" on storage.objects;

drop policy if exists "auth_insert_fotos_intervenciones" on storage.objects;
create policy "auth_insert_fotos_intervenciones"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos-intervenciones'
  and public.fn_es_sesion_no_anon_sat()
);

drop policy if exists "auth_update_fotos_intervenciones" on storage.objects;
create policy "auth_update_fotos_intervenciones"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fotos-intervenciones'
  and public.fn_es_sesion_no_anon_sat()
)
with check (
  bucket_id = 'fotos-intervenciones'
  and public.fn_es_sesion_no_anon_sat()
);

drop policy if exists "auth_delete_fotos_intervenciones" on storage.objects;
create policy "auth_delete_fotos_intervenciones"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fotos-intervenciones'
  and public.fn_es_sesion_no_anon_sat()
);

-- Informes partes

drop policy if exists "dev_public_insert_informes_partes" on storage.objects;
drop policy if exists "dev_public_update_informes_partes" on storage.objects;
drop policy if exists "dev_public_delete_informes_partes" on storage.objects;

drop policy if exists "auth_insert_informes_partes" on storage.objects;
create policy "auth_insert_informes_partes"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'informes-partes'
  and public.fn_es_sesion_no_anon_sat()
);

drop policy if exists "auth_update_informes_partes" on storage.objects;
create policy "auth_update_informes_partes"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'informes-partes'
  and public.fn_es_sesion_no_anon_sat()
)
with check (
  bucket_id = 'informes-partes'
  and public.fn_es_sesion_no_anon_sat()
);

drop policy if exists "auth_delete_informes_partes" on storage.objects;
create policy "auth_delete_informes_partes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'informes-partes'
  and public.fn_es_sesion_no_anon_sat()
);

-- Nota: la opcion "Leaked Password Protection" se habilita en Dashboard > Authentication > Settings.
