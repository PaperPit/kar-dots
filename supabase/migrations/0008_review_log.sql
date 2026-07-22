-- ============================================================
-- КАР-точки — миграция 0008: журнал повторений (review log)
-- Каждое повторение = строка: карточка, оценка, интервал, время.
-- Основа для статистики удержания, прогноза нагрузки и оптимизации FSRS.
-- ============================================================

create table if not exists public.review_log (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid,
  folder_id uuid,
  algo text,
  rating smallint,
  known smallint,
  elapsed_days double precision,
  state_before smallint,
  stability_before double precision,
  ts bigint not null
);

create index if not exists review_log_user_ts_idx on public.review_log (user_id, ts);
create index if not exists review_log_card_idx on public.review_log (card_id);

alter table public.review_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'review_log' and policyname = 'own review_log'
  ) then
    create policy "own review_log" on public.review_log
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

insert into public.schema_meta (id, version)
values (1, 8)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
