-- Später-Erinnerung: optionale WhatsApp-/E-Mail-Push-Kanäle pro Follow-up.

alter table public.contact_conversation_follow_ups
  add column if not exists notify_whatsapp boolean not null default false,
  add column if not exists notify_email boolean not null default false;

comment on column public.contact_conversation_follow_ups.notify_whatsapp is
  'Bei fälligem Reminder zusätzlich WhatsApp-Push an Team (Profil-Prefs müssen Modul erlauben).';
comment on column public.contact_conversation_follow_ups.notify_email is
  'Bei fälligem Reminder zusätzlich E-Mail-Push an Team (Profil-Prefs müssen Modul erlauben).';
