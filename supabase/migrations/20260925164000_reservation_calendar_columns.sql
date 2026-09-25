-- Live recorded 20260925123000 as applied, but reservations.calendar_sequence
-- is still missing (42703). Re-apply only those three columns.

alter table public.reservations
  add column if not exists calendar_sequence integer not null default 0;

alter table public.reservations
  add column if not exists calendar_fingerprint text;

alter table public.reservations
  add column if not exists calendar_emailed_fingerprint text;

notify pgrst, 'reload schema';
