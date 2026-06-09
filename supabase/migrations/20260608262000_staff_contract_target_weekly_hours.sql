-- Soll-Wochenstunden pro Vertrag (optional, für Schichtplan-Abgleich)
alter table public.restaurant_staff_contracts
  add column if not exists target_weekly_minutes integer;

alter table public.restaurant_staff_contracts
  drop constraint if exists restaurant_staff_contracts_target_weekly_minutes_positive;

alter table public.restaurant_staff_contracts
  add constraint restaurant_staff_contracts_target_weekly_minutes_positive
  check (target_weekly_minutes is null or target_weekly_minutes > 0);

comment on column public.restaurant_staff_contracts.target_weekly_minutes is
  'Optionale Soll-Wochenarbeitszeit in Minuten (Schichtplan).';
