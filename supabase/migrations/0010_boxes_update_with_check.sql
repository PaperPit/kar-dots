-- ============================================================
-- КАР-точки — миграция 0010: boxes_update_own — WITH CHECK
-- Без WITH CHECK Postgres не проверяет строку после UPDATE:
-- можно было сделать set user_id = '<чужой uuid>'.
-- ============================================================

drop policy if exists "boxes_update_own" on public.boxes;
create policy "boxes_update_own" on public.boxes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.schema_meta (id, version)
values (1, 10)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
