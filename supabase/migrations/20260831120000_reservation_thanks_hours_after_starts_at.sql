-- Danke/Bewertung: Anker ist starts_at (Termin-Uhrzeit), nicht ends_at.
comment on column public.restaurant_reservation_settings.whatsapp_thanks_hours_after is
  'Danke/Bewertung X Stunden nach starts_at (Termin-Uhrzeit).';

comment on column public.restaurant_reservation_settings.email_thanks_hours_after is
  'Danke/Bewertung X Stunden nach starts_at (Termin-Uhrzeit).';
