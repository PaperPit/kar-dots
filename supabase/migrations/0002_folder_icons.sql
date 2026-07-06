-- ============================================================
-- КАР-точки — миграция 0002: значки и метки наборов у папок
-- ============================================================

alter table public.folders add column if not exists icon text;
alter table public.folders add column if not exists pack_id text;
alter table public.folders add column if not exists pack_version integer;

insert into public.schema_meta (id, version)
values (1, 2)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
