-- Kontakte automatisch bei eingehenden Nachrichten anlegen (wie Reservierungen).

alter table public.restaurant_contact_settings
  add column if not exists auto_create_from_messages boolean not null default true;

comment on column public.restaurant_contact_settings.auto_create_from_messages is
  'Bei eingehender WhatsApp/E-Mail/Meta-Nachricht Kontakt anlegen, wenn keiner passt.';
