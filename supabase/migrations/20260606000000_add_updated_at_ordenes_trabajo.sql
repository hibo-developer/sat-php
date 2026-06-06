alter table public.ordenes_trabajo
  add column if not exists updated_at timestamp with time zone default now();

update public.ordenes_trabajo
  set updated_at = now()
  where updated_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_ordenes_trabajo on public.ordenes_trabajo;
create trigger trg_set_updated_at_ordenes_trabajo
before update on public.ordenes_trabajo
for each row
execute function public.set_updated_at();

create index if not exists idx_ordenes_trabajo_updated_at on public.ordenes_trabajo(updated_at);
