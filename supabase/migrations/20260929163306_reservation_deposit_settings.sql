alter table public.restaurant_reservation_settings
  add column if not exists deposit_enabled boolean not null default false,
  add column if not exists deposit_min_party_size integer not null default 1,
  add column if not exists deposit_amount_cents_per_person integer not null default 0,
  add column if not exists deposit_due_hours_before integer not null default 24;

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_deposit_min_party_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_deposit_min_party_check
  check (deposit_min_party_size between 1 and 200);

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_deposit_amount_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_deposit_amount_check
  check (deposit_amount_cents_per_person between 0 and 1000000);

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_deposit_due_hours_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_deposit_due_hours_check
  check (deposit_due_hours_before between 0 and 720);

comment on column public.restaurant_reservation_settings.deposit_enabled is
  'Anzahlung nur wenn das Restaurant den Schalter speichert. Default false, auch ohne Zeile. Zahlung an den Gast ist separat.';
comment on column public.restaurant_reservation_settings.deposit_min_party_size is
  'Anzahlung gilt ab dieser Personenzahl (>=).';
comment on column public.restaurant_reservation_settings.deposit_amount_cents_per_person is
  'Anzahlung in Cent pro Person.';
comment on column public.restaurant_reservation_settings.deposit_due_hours_before is
  'Stunden vor Reservierungsbeginn, zu denen die Anzahlung fällig ist.';
