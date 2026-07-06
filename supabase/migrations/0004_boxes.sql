-- ============================================================
-- КАР-точки — миграция 0004: коробки (группы папок)
-- Карточки остаются в папках; коробка лишь группирует папки.
-- ============================================================

create table if not exists public.boxes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#8F3D18',
  icon text,
  created_at bigint not null
);

alter table public.folders
  add column if not exists box_id uuid references public.boxes (id) on delete set null;

alter table public.boxes enable row level security;

drop policy if exists "boxes_select_own" on public.boxes;
create policy "boxes_select_own" on public.boxes
  for select using (auth.uid() = user_id);

drop policy if exists "boxes_insert_own" on public.boxes;
create policy "boxes_insert_own" on public.boxes
  for insert with check (auth.uid() = user_id);

drop policy if exists "boxes_update_own" on public.boxes;
create policy "boxes_update_own" on public.boxes
  for update using (auth.uid() = user_id);

drop policy if exists "boxes_delete_own" on public.boxes;
create policy "boxes_delete_own" on public.boxes
  for delete using (auth.uid() = user_id);

insert into public.schema_meta (id, version)
values (1, 4)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
