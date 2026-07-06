-- FSRS columns for cards table (Supabase / Postgres)
-- Run in SQL Editor if you use cloud sync with algo=fsrs.

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
