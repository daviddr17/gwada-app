-- Mindest-Vorlaufzeit für öffentliche Online-Buchungen (Stunden ab jetzt).
alter table public.restaurant_reservation_settings
  add column if not exists booking_lead_time_hours numeric(6, 2) not null default 2
    check (
      booking_lead_time_hours >= 0
      and booking_lead_time_hours <= 168
    );

comment on column public.restaurant_reservation_settings.booking_lead_time_hours is
  'Früheste Buchung: starts_at muss mindestens so viele Stunden nach Buchungszeitpunkt liegen (Embed/Gast).';
