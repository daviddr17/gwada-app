-- WhatsApp: weitere Status + anpassbare Textvorlagen pro Nachrichtentyp.

alter table public.restaurant_reservation_settings
  add column if not exists whatsapp_cancelled_enabled boolean not null default true,
  add column if not exists whatsapp_declined_enabled boolean not null default true,
  add column if not exists whatsapp_no_show_enabled boolean not null default true,
  add column if not exists whatsapp_received_template text,
  add column if not exists whatsapp_confirmed_template text,
  add column if not exists whatsapp_reminder_template text,
  add column if not exists whatsapp_thanks_template text,
  add column if not exists whatsapp_cancelled_template text,
  add column if not exists whatsapp_declined_template text,
  add column if not exists whatsapp_no_show_template text;

comment on column public.restaurant_reservation_settings.whatsapp_received_template is
  'Eigener WhatsApp-Text (Platzhalter {anrede}, {datum}, …). Leer = Standard.';
comment on column public.restaurant_reservation_settings.whatsapp_cancelled_template is
  'WhatsApp bei Status Storniert.';

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_whatsapp_template_len_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_whatsapp_template_len_check
  check (
    (whatsapp_received_template is null or length(whatsapp_received_template) <= 4000)
    and (whatsapp_confirmed_template is null or length(whatsapp_confirmed_template) <= 4000)
    and (whatsapp_reminder_template is null or length(whatsapp_reminder_template) <= 4000)
    and (whatsapp_thanks_template is null or length(whatsapp_thanks_template) <= 4000)
    and (whatsapp_cancelled_template is null or length(whatsapp_cancelled_template) <= 4000)
    and (whatsapp_declined_template is null or length(whatsapp_declined_template) <= 4000)
    and (whatsapp_no_show_template is null or length(whatsapp_no_show_template) <= 4000)
  );

alter table public.reservation_whatsapp_outbox
  drop constraint if exists reservation_whatsapp_outbox_kind_check;

alter table public.reservation_whatsapp_outbox
  add constraint reservation_whatsapp_outbox_kind_check
  check (
    message_kind in (
      'received',
      'confirmed',
      'reminder',
      'thanks',
      'cancelled',
      'declined',
      'no_show'
    )
  );
