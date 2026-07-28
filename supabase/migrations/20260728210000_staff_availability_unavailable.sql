-- Self-Service: ganztägige „Nicht verfügbar“-Tage (neben positiven Verfügbarkeitsfenstern)

alter table public.restaurant_staff_availability_slots
  add column if not exists is_available boolean not null default true;

comment on column public.restaurant_staff_availability_slots.is_available is
  'true = verfügbar in start/end; false = nicht einsetzbar (ganztägig, nur service_date).';

alter table public.restaurant_staff_availability_slots
  drop constraint if exists restaurant_staff_availability_slots_unavailable_is_date;

alter table public.restaurant_staff_availability_slots
  add constraint restaurant_staff_availability_slots_unavailable_is_date check (
    is_available = true
    or (service_date is not null and weekday is null)
  );

comment on table public.restaurant_staff_availability_slots is
  'Verfügbarkeit / Nicht-Verfügbarkeit pro Mitarbeiter (wöchentliche Fenster oder einmalige Tage).';
