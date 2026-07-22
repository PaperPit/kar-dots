-- Надёжные RLS-политики для settings (upsert INSERT/UPDATE/SELECT).
-- Выполнить в Supabase SQL Editor, если сохранение настроек даёт:
-- "new row violates row-level security policy for table 'settings'"

alter table public.settings enable row level security;

drop policy if exists "own settings" on public.settings;
drop policy if exists "settings_select_own" on public.settings;
drop policy if exists "settings_insert_own" on public.settings;
drop policy if exists "settings_update_own" on public.settings;
drop policy if exists "settings_delete_own" on public.settings;

create policy "settings_select_own" on public.settings
  for select to authenticated
  using (auth.uid() = user_id);

create policy "settings_insert_own" on public.settings
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "settings_update_own" on public.settings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "settings_delete_own" on public.settings
  for delete to authenticated
  using (auth.uid() = user_id);

insert into public.schema_meta (id, version)
values (1, 7)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
