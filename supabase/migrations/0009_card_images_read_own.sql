-- ============================================================
-- КАР-точки — миграция 0009: card-images — запрет публичного list
-- SELECT только authenticated + своя папка {user_id}/…
-- Бакет остаётся public: img src через /object/public/… по известному
-- пути работает; POST /object/list больше не отдаёт чужие файлы.
-- ============================================================

drop policy if exists "read images" on storage.objects;
drop policy if exists "read own images" on storage.objects;

create policy "read own images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

insert into public.schema_meta (id, version)
values (1, 9)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
