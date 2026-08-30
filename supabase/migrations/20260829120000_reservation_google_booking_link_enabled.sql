-- Opt-in: Gwada-Buchungs-URL als Google Place Action (DINING_RESERVATION).
alter table public.restaurant_reservation_settings
  add column if not exists google_booking_link_enabled boolean not null default false;

comment on column public.restaurant_reservation_settings.google_booking_link_enabled is
  'Wenn true: Reservierungs-Link als Google Business Place Action (DINING_RESERVATION) aktiv.';
