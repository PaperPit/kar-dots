-- ============================================================
-- КАР-точки — миграция 0013: заметки (knowledge base)
--
-- Атомарная единица — заметка (Markdown body). Карточка — опциональный
-- дериватив: cards.note_id + cards.note_anchor указывают на фрагмент заметки.
--
-- Конфликты между устройствами: last-write-wins по updated_at. Проигравшая
-- сторона сохраняется как conflict-копия (conflict_of → победившая заметка).
--
-- synced_at ставит серверный триггер (как у cards в 0011): watermark дельты
-- и LWW живут на разных колонках.
--
-- Удаление заметки НЕ каскадит на карточки — только обнуляет ссылку (SET NULL).
-- ============================================================

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  conflict_of uuid references public.notes (id) on delete set null,
  created_at bigint not null,
  updated_at bigint not null,
  synced_at bigint not null default 0
);

create index if not exists notes_user_idx on public.notes (user_id);
create index if not exists notes_user_updated_at_idx on public.notes (user_id, updated_at);
create index if not exists notes_user_synced_at_idx on public.notes (user_id, synced_at);
create index if not exists notes_conflict_of_idx on public.notes (conflict_of);

alter table public.notes enable row level security;

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Серверные часы для дельта-синка заметок (см. 0011 для карточек).
create or replace function public.notes_stamp_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := (extract(epoch from now()) * 1000)::bigint;
  return new;
end;
$$;

drop trigger if exists notes_stamp_synced_at on public.notes;
create trigger notes_stamp_synced_at
  before insert or update on public.notes
  for each row execute function public.notes_stamp_synced_at();

-- Ссылки карточек на заметку: удаление заметки только отвязывает карточки.
alter table public.cards add column if not exists note_id uuid
  references public.notes (id) on delete set null;
alter table public.cards add column if not exists note_anchor text;

create index if not exists cards_note_id_idx on public.cards (note_id);

insert into public.schema_meta (id, version)
values (1, 13)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
