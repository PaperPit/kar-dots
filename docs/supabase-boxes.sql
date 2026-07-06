-- Коробки: группы папок (карточки остаются в папках).
-- Выполните в Supabase → SQL Editor.

create table if not exists public.boxes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#8F3D18',
  icon text,
  created_at bigint not null
);

alter table public.boxes add column if not exists icon text;

alter table public.folders add column if not exists box_id uuid references public.boxes (id) on delete set null;

alter table public.boxes enable row level security;

create policy "boxes_select_own" on public.boxes
  for select using (auth.uid() = user_id);

create policy "boxes_insert_own" on public.boxes
  for insert with check (auth.uid() = user_id);

create policy "boxes_update_own" on public.boxes
  for update using (auth.uid() = user_id);

create policy "boxes_delete_own" on public.boxes
  for delete using (auth.uid() = user_id);

-- После миграции перезагрузите приложение — коробки начнут синхронизироваться.
