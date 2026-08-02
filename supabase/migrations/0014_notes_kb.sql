-- ============================================================
-- КАР-точки — миграция 0014: заметки как база знаний
--
-- folder_id — положить заметку в папку (как «полку»).
-- tags      — хештеги из тела (нормализованные, без #), для фильтра и графа.
-- Связи заметка↔заметка живут в Markdown как [[Заголовок]] и
-- вычисляются на клиенте — отдельная таблица рёбер не нужна.
-- ============================================================

alter table public.notes
  add column if not exists folder_id uuid references public.folders (id) on delete set null;

alter table public.notes
  add column if not exists tags text[] not null default '{}';

create index if not exists notes_folder_id_idx on public.notes (folder_id);
create index if not exists notes_tags_gin on public.notes using gin (tags);

insert into public.schema_meta (id, version)
values (1, 14)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
