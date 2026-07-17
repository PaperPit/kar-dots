-- ============================================================
-- КАР-точки — миграция 0006: индекс для delta sync по cards.updated_at
--
-- Ускоряет select ... where user_id = ? and updated_at > ?
-- (см. js/data/cloud-delta.js / CloudStore._pullCardsDelta).
-- ============================================================

create index if not exists cards_user_updated_at_idx
  on public.cards (user_id, updated_at);

insert into public.schema_meta (id, version)
values (1, 6)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
