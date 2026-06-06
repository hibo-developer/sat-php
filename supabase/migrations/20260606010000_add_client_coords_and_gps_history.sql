alter table public.clientes
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create index if not exists idx_clientes_lat_lng on public.clientes(lat, lng);

create table if not exists public.ordenes_trabajo_gps (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  tecnico_id uuid references public.tecnicos(id),
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  recorded_at timestamp with time zone not null default now(),
  tipo text not null default 'tracking' check (tipo in ('tracking', 'arrival', 'manual')),
  source text default 'app',
  created_at timestamp with time zone default now()
);

alter table public.ordenes_trabajo_gps enable row level security;

drop policy if exists "ordenes_gps_select" on public.ordenes_trabajo_gps;
create policy "ordenes_gps_select"
on public.ordenes_trabajo_gps for select to authenticated
using (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  and (private_sat.fn_es_oficina_o_admin_sat() or private_sat.fn_es_tecnico_de_orden_sat(orden_id))
);

drop policy if exists "ordenes_gps_insert" on public.ordenes_trabajo_gps;
create policy "ordenes_gps_insert"
on public.ordenes_trabajo_gps for insert to authenticated
with check (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  and (private_sat.fn_es_oficina_o_admin_sat() or private_sat.fn_es_tecnico_de_orden_sat(orden_id))
);

drop policy if exists "ordenes_gps_delete_admin" on public.ordenes_trabajo_gps;
create policy "ordenes_gps_delete_admin"
on public.ordenes_trabajo_gps for delete to authenticated
using (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  and private_sat.fn_es_admin_sat()
);

create index if not exists idx_ordenes_trabajo_gps_orden on public.ordenes_trabajo_gps(orden_id);
create index if not exists idx_ordenes_trabajo_gps_recorded_at on public.ordenes_trabajo_gps(recorded_at);
