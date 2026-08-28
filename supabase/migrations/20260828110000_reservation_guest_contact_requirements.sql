alter table public.restaurant_reservation_settings
  add column if not exists guest_email_required_enabled boolean not null default false,
  add column if not exists guest_email_required_min_party_size integer not null default 6,
  add column if not exists guest_phone_required_enabled boolean not null default false,
  add column if not exists guest_phone_required_min_party_size integer not null default 6;

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_guest_email_min_party_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_guest_email_min_party_check
  check (guest_email_required_min_party_size between 1 and 200);

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_guest_phone_min_party_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_guest_phone_min_party_check
  check (guest_phone_required_min_party_size between 1 and 200);

comment on column public.restaurant_reservation_settings.guest_email_required_enabled is
  'Ab guest_email_required_min_party_size ist E-Mail Pflicht (Dashboard, Display, Online).';
comment on column public.restaurant_reservation_settings.guest_email_required_min_party_size is
  'Personenzahl-Schwelle für Pflicht-E-Mail (>=).';
comment on column public.restaurant_reservation_settings.guest_phone_required_enabled is
  'Ab guest_phone_required_min_party_size ist Telefon Pflicht (Dashboard, Display, Online).';
comment on column public.restaurant_reservation_settings.guest_phone_required_min_party_size is
  'Personenzahl-Schwelle für Pflicht-Telefon (>=).';
