-- Optionaler Firmenname am Reservierungsgast (nicht Pflicht).

alter table public.reservations
  add column if not exists guest_company text;

comment on column public.reservations.guest_company is
  'Optionaler Firmenname des Reservierungsgasts.';

alter table public.reservations
  drop constraint if exists reservations_guest_company_len;

alter table public.reservations
  add constraint reservations_guest_company_len
  check (
    guest_company is null
    or char_length(guest_company) between 1 and 200
  );
