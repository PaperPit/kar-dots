-- ============================================================
-- КАР-точки — схема базы для Supabase
-- Вставьте весь файл в SQL Editor вашего проекта Supabase
-- и нажмите Run. Подробности в README.md.
-- ============================================================

-- Папки
create table if not exists public.folders (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text default '#7C8DB5',
  created_at bigint not null
);

-- Карточки
create table if not exists public.cards (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  front text default '',
  back text default '',
  description text default '',
  front_img text,
  back_img text,
  created_at bigint not null,
  -- состояние SM-2
  sm2_ef double precision default 2.5,
  sm2_reps integer default 0,
  sm2_ivl double precision default 0,
  sm2_due bigint,
  -- состояние коробок Лейтнера
  box integer default 0,
  box_due bigint
);

-- Настройки пользователя
create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'
);

create index if not exists cards_user_idx on public.cards (user_id);
create index if not exists cards_folder_idx on public.cards (folder_id);
create index if not exists folders_user_idx on public.folders (user_id);

-- ------------------------------------------------------------
-- Row Level Security: каждый видит только свои данные
-- ------------------------------------------------------------
alter table public.folders enable row level security;
alter table public.cards enable row level security;
alter table public.settings enable row level security;

drop policy if exists "own folders" on public.folders;
create policy "own folders" on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cards" on public.cards;
create policy "own cards" on public.cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Хранилище картинок: публичный бакет card-images.
-- Файлы лежат в папке с id пользователя: {user_id}/xxx.jpg
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

drop policy if exists "upload own images" on storage.objects;
create policy "upload own images" on storage.objects
  for insert with check (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "delete own images" on storage.objects;
create policy "delete own images" on storage.objects
  for delete using (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "read images" on storage.objects;
create policy "read images" on storage.objects
  for select using (bucket_id = 'card-images');

-- ------------------------------------------------------------
-- Миграции для уже созданных баз (безопасно запускать повторно)
-- ------------------------------------------------------------
alter table public.cards add column if not exists description text default '';
