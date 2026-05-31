-- Mehrkanal-Sendungen gruppieren; WAHA-Import deduplizieren.

alter table public.contact_messages
  add column if not exists external_source_id text,
  add column if not exists send_batch_id uuid;

create unique index if not exists contact_messages_external_source_uidx
  on public.contact_messages (restaurant_id, external_source_id)
  where external_source_id is not null;

create index if not exists contact_messages_send_batch_idx
  on public.contact_messages (send_batch_id)
  where send_batch_id is not null;
