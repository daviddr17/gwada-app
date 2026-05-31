-- E-Mail: Absendername (global) + Betreff pro Benachrichtigung mit Platzhaltern.

alter table public.restaurant_reservation_settings
  add column if not exists email_sender_name text,
  add column if not exists email_received_subject text,
  add column if not exists email_confirmed_subject text,
  add column if not exists email_reminder_subject text,
  add column if not exists email_thanks_subject text,
  add column if not exists email_cancelled_subject text,
  add column if not exists email_declined_subject text,
  add column if not exists email_no_show_subject text;

comment on column public.restaurant_reservation_settings.email_sender_name is
  'Anzeigename im From-Header für alle E-Mail-Benachrichtigungen dieses Restaurants.';

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_email_subject_len_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_email_subject_len_check
  check (
    (email_sender_name is null or length(email_sender_name) <= 120)
    and (email_received_subject is null or length(email_received_subject) <= 300)
    and (email_confirmed_subject is null or length(email_confirmed_subject) <= 300)
    and (email_reminder_subject is null or length(email_reminder_subject) <= 300)
    and (email_thanks_subject is null or length(email_thanks_subject) <= 300)
    and (email_cancelled_subject is null or length(email_cancelled_subject) <= 300)
    and (email_declined_subject is null or length(email_declined_subject) <= 300)
    and (email_no_show_subject is null or length(email_no_show_subject) <= 300)
  );
