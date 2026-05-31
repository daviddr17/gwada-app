-- E-Mail-Benachrichtigungen (gleiche Struktur wie WhatsApp, Versand folgt).

alter table public.restaurant_reservation_settings
  add column if not exists email_received_enabled boolean not null default true,
  add column if not exists email_confirmed_enabled boolean not null default true,
  add column if not exists email_reminder_enabled boolean not null default true,
  add column if not exists email_reminder_hours_before numeric(6, 2) not null default 24
    check (email_reminder_hours_before >= 0 and email_reminder_hours_before <= 168),
  add column if not exists email_thanks_enabled boolean not null default true,
  add column if not exists email_thanks_hours_after numeric(6, 2) not null default 2
    check (email_thanks_hours_after >= 0 and email_thanks_hours_after <= 168),
  add column if not exists email_cancelled_enabled boolean not null default true,
  add column if not exists email_declined_enabled boolean not null default true,
  add column if not exists email_no_show_enabled boolean not null default true,
  add column if not exists email_received_template text,
  add column if not exists email_confirmed_template text,
  add column if not exists email_reminder_template text,
  add column if not exists email_thanks_template text,
  add column if not exists email_cancelled_template text,
  add column if not exists email_declined_template text,
  add column if not exists email_no_show_template text;

comment on column public.restaurant_reservation_settings.email_received_enabled is
  'E-Mail bei neuer Reservierung (Status Offen). Versand noch nicht angebunden.';

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_email_template_len_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_email_template_len_check
  check (
    (email_received_template is null or length(email_received_template) <= 4000)
    and (email_confirmed_template is null or length(email_confirmed_template) <= 4000)
    and (email_reminder_template is null or length(email_reminder_template) <= 4000)
    and (email_thanks_template is null or length(email_thanks_template) <= 4000)
    and (email_cancelled_template is null or length(email_cancelled_template) <= 4000)
    and (email_declined_template is null or length(email_declined_template) <= 4000)
    and (email_no_show_template is null or length(email_no_show_template) <= 4000)
  );
