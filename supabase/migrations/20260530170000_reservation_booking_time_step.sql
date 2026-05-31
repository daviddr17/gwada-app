-- Buchungs-Raster: welche Minuten im Reservierungsformular / Display erlaubt sind.

alter table public.restaurant_reservation_settings
  add column if not exists booking_time_step_minutes smallint not null default 15;

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_booking_time_step_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_booking_time_step_check
  check (booking_time_step_minutes in (1, 10, 15, 30));

comment on column public.restaurant_reservation_settings.booking_time_step_minutes is
  'Minuten-Raster für buchbare Startzeiten (1, 10, 15 oder 30).';
