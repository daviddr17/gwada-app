-- Push-Zustellung: optionale E-Mail neben auth.users.email; Telefon nutzt profiles.phone.

alter table public.profiles
  add column if not exists notification_email text;

comment on column public.profiles.notification_email is
  'Optionale E-Mail für Push-Benachrichtigungen; leer = Fallback auf auth.users.email.';

comment on column public.profiles.phone is
  'Telefonnummer des Nutzers (z. B. für Push per WhatsApp).';
