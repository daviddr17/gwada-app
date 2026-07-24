-- Phase 2: Hub Outbox / Sync Idempotency + line kitchen-fired flag.

create table if not exists public.pos_sync_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  idempotency_key text not null,
  event_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  device_id uuid references public.pos_devices (id) on delete set null,
  waiter_profile_id uuid references public.profiles (id) on delete set null,
  session_id uuid references public.pos_table_sessions (id) on delete set null,
  result jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, idempotency_key)
);

create index if not exists pos_sync_events_restaurant_created_idx
  on public.pos_sync_events (restaurant_id, created_at desc);

alter table public.pos_sync_events enable row level security;

drop policy if exists pos_sync_events_staff_all on public.pos_sync_events;
create policy pos_sync_events_staff_all
  on public.pos_sync_events for all
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_sync_events is
  'Idempotente Hub→Cloud Sync-Events (Nest POST /v1/sync/events).';

-- Kitchen fire snapshot on lines (Prototyp „Gang schicken“)
alter table public.pos_order_lines
  add column if not exists fired_at timestamptz null;

comment on column public.pos_order_lines.fired_at is
  'Wann die Position an die Küche geschickt wurde (course.fired).';
