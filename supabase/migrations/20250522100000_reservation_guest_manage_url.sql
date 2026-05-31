-- Optionaler Gast-Link in WhatsApp-Nachrichten ({nummer}, {pin}).

alter table public.restaurant_reservation_settings
  add column if not exists guest_manage_url_template text;

comment on column public.restaurant_reservation_settings.guest_manage_url_template is
  'Optional: URL-Vorlage für Gäste zum Ändern der Reservierung. Platzhalter {nummer}, {pin}.';

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_guest_manage_url_template_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_guest_manage_url_template_check
  check (
    guest_manage_url_template is null
    or (
      length(trim(guest_manage_url_template)) > 0
      and trim(guest_manage_url_template) ~ '^https?://'
      and length(guest_manage_url_template) <= 2000
    )
  );
