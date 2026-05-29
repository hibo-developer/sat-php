alter table public.ordenes_trabajo
  add column if not exists mecanicos_intervinieron integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ordenes_trabajo_mecanicos_intervinieron_check'
  ) then
    alter table public.ordenes_trabajo
      add constraint ordenes_trabajo_mecanicos_intervinieron_check
      check (mecanicos_intervinieron >= 1);
  end if;
end $$;
