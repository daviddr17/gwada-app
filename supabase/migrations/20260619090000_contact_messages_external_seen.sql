-- IMAP \\Seen in DB spiegeln — Unread-Zählung ohne Live-IMAP beim Listen/Glocke/Dashboard.

alter table public.contact_messages
  add column if not exists external_seen boolean;

comment on column public.contact_messages.external_seen is
  'email-imap: IMAP \\Seen; null = nicht relevant (Gwada/WAHA).';

-- Bestehende Spiegel: als gelesen behandeln (kein Gwada-last_read_at → sonst alles „ungelesen“).
update public.contact_messages
set external_seen = true
where external_source_id like 'email-imap:%'
  and direction = 'inbound'
  and external_seen is null;
