-- Hub Sync Queue: idempotente Cash-Collects von iPad (client_attempt_id).
alter table public.pos_payments
  add column if not exists client_attempt_id text;

create unique index if not exists pos_payments_restaurant_client_attempt_uidx
  on public.pos_payments (restaurant_id, client_attempt_id)
  where client_attempt_id is not null;
