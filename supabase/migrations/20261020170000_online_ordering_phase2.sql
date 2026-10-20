-- Online ordering phase 2: guest notify prefs, timeslots, kiosk terminal, delivery GPS.

-- ---------------------------------------------------------------------------
-- Settings extensions
-- ---------------------------------------------------------------------------
alter table public.restaurant_online_ordering_settings
  add column if not exists notify_whatsapp_enabled boolean not null default true;

alter table public.restaurant_online_ordering_settings
  add column if not exists notify_email_enabled boolean not null default true;

-- Which statuses trigger guest notify (jsonb array of pos_order_status labels)
alter table public.restaurant_online_ordering_settings
  add column if not exists notify_statuses jsonb not null default
    '["received","preparing","ready","out_for_delivery","delivered","cancelled"]'::jsonb;

alter table public.restaurant_online_ordering_settings
  add column if not exists timeslots_enabled boolean not null default false;

alter table public.restaurant_online_ordering_settings
  add column if not exists slot_interval_minutes integer not null default 15
    check (slot_interval_minutes >= 5 and slot_interval_minutes <= 120);

alter table public.restaurant_online_ordering_settings
  add column if not exists slot_capacity integer not null default 8
    check (slot_capacity >= 1 and slot_capacity <= 200);

-- Horizon of bookable slots from "now" (hours)
alter table public.restaurant_online_ordering_settings
  add column if not exists slot_horizon_hours integer not null default 24
    check (slot_horizon_hours >= 1 and slot_horizon_hours <= 168);

-- Default Mollie terminal for counter kiosk (term_…)
alter table public.restaurant_online_ordering_settings
  add column if not exists kiosk_mollie_terminal_id text;

comment on column public.restaurant_online_ordering_settings.kiosk_mollie_terminal_id is
  'Mollie terminal id (term_…) for counter kiosk pointofsale payments.';

-- ---------------------------------------------------------------------------
-- Order: timeslot + delivery live location
-- ---------------------------------------------------------------------------
alter table public.pos_orders
  add column if not exists slot_start_at timestamptz;

alter table public.pos_orders
  add column if not exists slot_end_at timestamptz;

alter table public.pos_orders
  add column if not exists delivery_lat double precision;

alter table public.pos_orders
  add column if not exists delivery_lng double precision;

alter table public.pos_orders
  add column if not exists delivery_location_updated_at timestamptz;

alter table public.pos_orders
  add column if not exists delivery_tracking_active boolean not null default false;

create index if not exists pos_orders_restaurant_slot_start_idx
  on public.pos_orders (restaurant_id, slot_start_at)
  where slot_start_at is not null;

-- Optional trail of driver pings (last N kept by app; table for audit/live)
create table if not exists public.pos_order_delivery_locations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pos_orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  recorded_by_profile_id uuid references public.profiles (id) on delete set null
);

create index if not exists pos_order_delivery_locations_order_recorded_idx
  on public.pos_order_delivery_locations (order_id, recorded_at desc);

alter table public.pos_order_delivery_locations enable row level security;

drop policy if exists pos_order_delivery_locations_staff_all
  on public.pos_order_delivery_locations;

create policy pos_order_delivery_locations_staff_all
  on public.pos_order_delivery_locations for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_order_delivery_locations is
  'Driver/staff GPS pings while order is out_for_delivery; guest reads latest via status token API.';
