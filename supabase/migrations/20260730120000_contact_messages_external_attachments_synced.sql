-- IMAP-Anhänge: nur Metadaten in contact_message_attachments (storage_path = imap:{uid}:{index}).
-- Bytes bleiben im Postfach und werden erst beim Klick per Proxy geladen.
-- Dieses Flag verhindert wiederholtes Nachziehen für Mails ohne Anhänge.

alter table public.contact_messages
  add column if not exists external_attachments_synced boolean not null default false;

comment on column public.contact_messages.external_attachments_synced is
  'Anhang-Metadaten für externe Quellen (z. B. email-imap:) einmal synchronisiert; Bytes nicht in Storage.';

-- Nicht-IMAP-Nachrichten brauchen kein Nachziehen.
update public.contact_messages
set external_attachments_synced = true
where external_source_id is null
   or external_source_id not like 'email-imap:%';
