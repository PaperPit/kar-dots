-- ============================================================
-- КАР-точки — миграция 0005: updated_at для честной синхронизации
--
-- Зачем: офлайн-правки с двух устройств раньше разрешались по принципу
-- «кто последний подключился, тот и прав» (без учёта времени самой
-- правки). Теперь каждая запись несёт updated_at (мс, как created_at),
-- и обновление из очереди применяется на сервере только если наша
-- версия не старше текущей (last-write-wins на уровне записи) —
-- см. js/data/store-cloud.js::_applyPatchWithLww.
-- ============================================================

alter table public.folders add column if not exists updated_at bigint not null default 0;
update public.folders set updated_at = created_at where updated_at = 0;

alter table public.cards add column if not exists updated_at bigint not null default 0;
update public.cards set updated_at = created_at where updated_at = 0;

alter table public.boxes add column if not exists updated_at bigint not null default 0;
update public.boxes set updated_at = created_at where updated_at = 0;

-- У settings нет created_at — бэкфиллим текущим временем (единственная
-- строка на пользователя, конфликты маловероятны).
alter table public.settings add column if not exists updated_at bigint not null default 0;
update public.settings set updated_at = (extract(epoch from now()) * 1000)::bigint where updated_at = 0;

insert into public.schema_meta (id, version)
values (1, 5)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
