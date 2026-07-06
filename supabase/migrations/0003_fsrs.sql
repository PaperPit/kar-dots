-- ============================================================
-- КАР-точки — миграция 0003: состояние FSRS у карточек
-- ============================================================

alter table public.cards
  add column if not exists fsrs_state smallint,
  add column if not exists fsrs_stability double precision,
  add column if not exists fsrs_difficulty double precision,
  add column if not exists fsrs_due bigint,
  add column if not exists fsrs_scheduled_days double precision,
  add column if not exists fsrs_elapsed_days double precision,
  add column if not exists fsrs_reps integer,
  add column if not exists fsrs_lapses integer,
  add column if not exists fsrs_learning_steps integer,
  add column if not exists fsrs_last_review bigint;

create index if not exists cards_fsrs_due_idx on public.cards (user_id, fsrs_due)
  where fsrs_due is not null;

insert into public.schema_meta (id, version)
values (1, 3)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
