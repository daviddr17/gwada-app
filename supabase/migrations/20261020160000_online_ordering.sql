-- Online-Bestellung / Kiosk: channel + fulfillment on pos_orders, restaurant settings.
-- Extends existing POS pipeline (no second order silo). Depends on Mollie guest payments.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_order_channel') then
    create type public.pos_order_channel as enum (
      'pos',
      'online',
      'kiosk',
      'table'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_fulfillment_type') then
    create type public.pos_fulfillment_type as enum (
      'dine_in',
      'pickup',
      'delivery'
    );
  end if;
end$$;

-- Delivery step between ready and delivered
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'pos_order_status'
      and e.enumlabel = 'out_for_delivery'
  ) then
    alter type public.pos_order_status add value 'out_for_delivery' after 'ready';
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- pos_orders: guest / online fields
-- ---------------------------------------------------------------------------
alter table public.pos_orders
  add column if not exists channel public.pos_order_channel not null default 'pos';

alter table public.pos_orders
  add column if not exists fulfillment_type public.pos_fulfillment_type not null default 'dine_in';

alter table public.pos_orders
  add column if not exists guest_name text;

alter table public.pos_orders
  add column if not exists guest_phone text;

alter table public.pos_orders
  add column if not exists guest_email text;

alter table public.pos_orders
  add column if not exists delivery_address text;

alter table public.pos_orders
  add column if not exists delivery_city text;

alter table public.pos_orders
  add column if not exists delivery_postal_code text;

alter table public.pos_orders
  add column if not exists delivery_notes text;

alter table public.pos_orders
  add column if not exists delivery_fee_cents bigint not null default 0
    check (delivery_fee_cents >= 0);

alter table public.pos_orders
  add column if not exists guest_status_token text;

alter table public.pos_orders
  add column if not exists guest_payment_id uuid
    references public.restaurant_guest_payments (id) on delete set null;

alter table public.pos_orders
  add column if not exists dining_table_id uuid
    references public.dining_tables (id) on delete set null;

alter table public.pos_orders
  add column if not exists accepted_at timestamptz;

alter table public.pos_orders
  add column if not exists ready_at timestamptz;

alter table public.pos_orders
  add column if not exists out_for_delivery_at timestamptz;

alter table public.pos_orders
  add column if not exists completed_at timestamptz;

create unique index if not exists pos_orders_guest_status_token_uidx
  on public.pos_orders (guest_status_token)
  where guest_status_token is not null;

create index if not exists pos_orders_restaurant_channel_created_idx
  on public.pos_orders (restaurant_id, channel, created_at desc);

create index if not exists pos_orders_guest_payment_id_idx
  on public.pos_orders (guest_payment_id)
  where guest_payment_id is not null;

comment on column public.pos_orders.channel is
  'Bestellkanal: pos (Staff), online, kiosk (Counter), table (Tisch-QR/iPad).';
comment on column public.pos_orders.fulfillment_type is
  'Erfüllung: dine_in, pickup, delivery.';
comment on column public.pos_orders.guest_status_token is
  'Opaque Token für öffentliche Gast-Status-URL.';

-- Allow online/kiosk/table orders without table session
create or replace function public.pos_orders_enforce_table_session_restaurant()
returns trigger
language plpgsql
as $$
declare
  v_session_restaurant uuid;
begin
  if new.table_session_id is null then
    -- Gift voucher sales OR guest channels (online / kiosk / table)
    if new.gift_voucher_id is not null
       or coalesce(new.notes, '') like 'gift_voucher:%'
       or new.channel in ('online', 'kiosk', 'table') then
      return new;
    end if;
    raise exception 'pos_orders.table_session_id required unless gift voucher or guest channel';
  end if;

  select s.restaurant_id
  into v_session_restaurant
  from public.pos_table_sessions s
  where s.id = new.table_session_id;

  if v_session_restaurant is null then
    raise exception 'pos_orders.table_session_id not found';
  end if;

  if new.restaurant_id is distinct from v_session_restaurant then
    raise exception 'pos_orders.restaurant_id must match table session restaurant';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Link guest payments → orders (optional back-ref)
-- ---------------------------------------------------------------------------
alter table public.restaurant_guest_payments
  add column if not exists pos_order_id uuid
    references public.pos_orders (id) on delete set null;

create index if not exists restaurant_guest_payments_pos_order_id_idx
  on public.restaurant_guest_payments (pos_order_id)
  where pos_order_id is not null;

-- ---------------------------------------------------------------------------
-- Per-restaurant online / kiosk / delivery settings
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_online_ordering_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  online_enabled boolean not null default false,
  kiosk_enabled boolean not null default false,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  min_order_cents_pickup bigint not null default 0 check (min_order_cents_pickup >= 0),
  min_order_cents_delivery bigint not null default 0 check (min_order_cents_delivery >= 0),
  delivery_fee_cents bigint not null default 0 check (delivery_fee_cents >= 0),
  -- [{ "postalCode": "20095", "feeCents": 250, "minOrderCents": 1500 }]
  delivery_zones jsonb not null default '[]'::jsonb,
  pickup_lead_minutes integer not null default 20 check (pickup_lead_minutes >= 0),
  delivery_lead_minutes integer not null default 45 check (delivery_lead_minutes >= 0),
  -- Idle reset on kiosk tablets (seconds)
  kiosk_idle_seconds integer not null default 90 check (kiosk_idle_seconds >= 30),
  -- Optional free-form hours override; empty = use restaurant opening hours
  order_hours jsonb not null default '{}'::jsonb,
  guest_status_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurant_online_ordering_settings_set_updated_at
  before update on public.restaurant_online_ordering_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_online_ordering_settings enable row level security;

drop policy if exists restaurant_online_ordering_settings_staff_all
  on public.restaurant_online_ordering_settings;

create policy restaurant_online_ordering_settings_staff_all
  on public.restaurant_online_ordering_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_online_ordering_settings is
  'Online-Bestellung, Kiosk und Liefer-/Abhol-Einstellungen pro Restaurant.';
