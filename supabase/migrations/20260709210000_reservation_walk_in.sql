-- Walk-in / Laufkunde: optional per restaurant (Display), marker on reservation rows.

alter table public.restaurant_reservation_settings
  add column if not exists walk_in_enabled boolean not null default false;

comment on column public.restaurant_reservation_settings.walk_in_enabled is
  'Walk-in / Laufkunde im Display aktivieren (Tisch sofort belegen).';

alter table public.reservations
  add column if not exists is_walk_in boolean not null default false;

comment on column public.reservations.is_walk_in is
  'Reservierung als Walk-in / Laufkunde über Display angelegt.';
