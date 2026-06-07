-- POS foundation for Gwada Staff: table sessions, orders, payments, Fiskaly TSE.
-- Domain types align with @gwada/pos-domain.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_order_status') then
    create type public.pos_order_status as enum (
      'pending_payment',
      'received',
      'preparing',
      'ready',
      'delivered',
      'cancelled'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_payment_status') then
    create type public.pos_payment_status as enum (
      'open',
      'paid',
      'failed',
      'refunded'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_payment_method') then
    create type public.pos_payment_method as enum (
      'cash',
      'card',
      'paypal',
      'terminal'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_table_session_status') then
    create type public.pos_table_session_status as enum (
      'open',
      'closed'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Menu: VAT for POS / Fiskaly
-- ---------------------------------------------------------------------------
alter table public.menu_items
  add column if not exists vat_rate smallint not null default 19;

alter table public.menu_items
  drop constraint if exists menu_items_vat_rate_chk;

alter table public.menu_items
  add constraint menu_items_vat_rate_chk
  check (vat_rate in (0, 7, 19));

comment on column public.menu_items.vat_rate is
  'German VAT rate in percent (0, 7, 19) for POS receipts and Fiskaly SIGN DE.';

-- ---------------------------------------------------------------------------
-- Per-restaurant order numbers
-- ---------------------------------------------------------------------------
create table public.pos_order_counters (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  last_number integer not null default 0 check (last_number >= 0)
);

alter table public.pos_order_counters enable row level security;

create policy pos_order_counters_staff_all
  on public.pos_order_counters for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Table sessions (open table / cover count)
-- ---------------------------------------------------------------------------
create table public.pos_table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  dining_table_id uuid not null references public.dining_tables (id) on delete restrict,
  status public.pos_table_session_status not null default 'open',
  cover_count integer not null default 1 check (cover_count >= 1 and cover_count <= 50),
  is_fully_paid boolean not null default false,
  reservation_id uuid references public.reservations (id) on delete set null,
  opened_by_profile_id uuid references public.profiles (id) on delete set null,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index pos_table_sessions_restaurant_status_idx
  on public.pos_table_sessions (restaurant_id, status, opened_at desc);

create index pos_table_sessions_table_idx
  on public.pos_table_sessions (dining_table_id, status);

create unique index pos_table_sessions_one_open_per_table_idx
  on public.pos_table_sessions (dining_table_id)
  where status = 'open';

create trigger pos_table_sessions_set_updated_at
  before update on public.pos_table_sessions
  for each row execute function public.set_updated_at();

alter table public.pos_table_sessions enable row level security;

create policy pos_table_sessions_staff_all
  on public.pos_table_sessions for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_table_sessions is
  'Active or closed dining session at a table; groups POS orders until fully paid.';

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.pos_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_session_id uuid not null references public.pos_table_sessions (id) on delete restrict,
  order_number integer not null check (order_number > 0),
  status public.pos_order_status not null default 'pending_payment',
  currency char(3) not null default 'EUR',
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tip_cents bigint not null default 0 check (tip_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  notes text,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  fiskaly_failed_at timestamptz,
  receipt_url text,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, order_number)
);

create index pos_orders_restaurant_status_idx
  on public.pos_orders (restaurant_id, status, created_at desc);

create index pos_orders_table_session_idx
  on public.pos_orders (table_session_id, created_at desc);

create index pos_orders_active_idx
  on public.pos_orders (restaurant_id, created_at desc)
  where status not in ('delivered', 'cancelled');

create index pos_orders_fiskaly_failed_idx
  on public.pos_orders (restaurant_id, fiskaly_failed_at)
  where fiskaly_failed_at is not null;

create trigger pos_orders_set_updated_at
  before update on public.pos_orders
  for each row execute function public.set_updated_at();

alter table public.pos_orders enable row level security;

create policy pos_orders_staff_all
  on public.pos_orders for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_orders is
  'Waiter POS orders; amounts in integer cents. Status flow matches @gwada/pos-domain.';

-- ---------------------------------------------------------------------------
-- Order lines
-- ---------------------------------------------------------------------------
create table public.pos_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pos_orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  vat_rate smallint not null default 19 check (vat_rate in (0, 7, 19)),
  line_total_cents bigint not null default 0 check (line_total_cents >= 0),
  notes text,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index pos_order_lines_order_idx
  on public.pos_order_lines (order_id, position);

alter table public.pos_order_lines enable row level security;

create policy pos_order_lines_staff_all
  on public.pos_order_lines for all
  using (
    exists (
      select 1
      from public.pos_orders o
      where o.id = pos_order_lines.order_id
        and public.auth_is_restaurant_staff(o.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.pos_orders o
      where o.id = pos_order_lines.order_id
        and public.auth_is_restaurant_staff(o.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Payments (Mollie + cash)
-- ---------------------------------------------------------------------------
create table public.pos_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null references public.pos_orders (id) on delete cascade,
  mollie_payment_id text,
  amount_cents bigint not null check (amount_cents >= 0),
  tip_cents bigint not null default 0 check (tip_cents >= 0),
  received_amount_cents bigint check (received_amount_cents is null or received_amount_cents >= 0),
  currency char(3) not null default 'EUR',
  method public.pos_payment_method not null,
  status public.pos_payment_status not null default 'open',
  split_group uuid,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index pos_payments_mollie_payment_id_idx
  on public.pos_payments (mollie_payment_id)
  where mollie_payment_id is not null;

create index pos_payments_order_idx
  on public.pos_payments (order_id, status);

create index pos_payments_split_group_idx
  on public.pos_payments (split_group)
  where split_group is not null;

create trigger pos_payments_set_updated_at
  before update on public.pos_payments
  for each row execute function public.set_updated_at();

alter table public.pos_payments enable row level security;

create policy pos_payments_staff_all
  on public.pos_payments for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Fiskaly / TSE transactions
-- ---------------------------------------------------------------------------
create table public.pos_fiscal_transactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null references public.pos_orders (id) on delete restrict,
  split_group uuid,
  tss_id text not null,
  client_id text not null,
  tx_id text not null,
  tx_revision integer not null default 1 check (tx_revision >= 1),
  signature text not null,
  signature_counter integer not null check (signature_counter >= 0),
  state text not null,
  fiskaly_receipt_id text,
  receipt_public_url text,
  custom_receipt_url text,
  signed_at timestamptz,
  is_retroactive boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tx_id),
  unique (split_group)
);

create index pos_fiscal_transactions_order_idx
  on public.pos_fiscal_transactions (order_id);

create index pos_fiscal_transactions_restaurant_idx
  on public.pos_fiscal_transactions (restaurant_id, created_at desc);

alter table public.pos_fiscal_transactions enable row level security;

create policy pos_fiscal_transactions_staff_all
  on public.pos_fiscal_transactions for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_fiscal_transactions is
  'Fiskaly SIGN DE transaction records; tx_id typically equals pos_orders.id for idempotent signing.';

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------
create or replace function public.pos_orders_set_order_number()
returns trigger
language plpgsql
as $$
declare
  v_next integer;
begin
  if new.order_number is not null and new.order_number > 0 then
    return new;
  end if;

  insert into public.pos_order_counters (restaurant_id, last_number)
  values (new.restaurant_id, 1)
  on conflict (restaurant_id) do update
    set last_number = public.pos_order_counters.last_number + 1
  returning last_number into v_next;

  new.order_number := v_next;
  return new;
end;
$$;

create trigger pos_orders_allocate_order_number
  before insert on public.pos_orders
  for each row execute function public.pos_orders_set_order_number();

create or replace function public.pos_orders_enforce_table_session_restaurant()
returns trigger
language plpgsql
as $$
declare
  v_session_restaurant uuid;
begin
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

create trigger pos_orders_table_session_restaurant
  before insert or update of table_session_id, restaurant_id on public.pos_orders
  for each row execute function public.pos_orders_enforce_table_session_restaurant();

create or replace function public.pos_payments_sync_restaurant()
returns trigger
language plpgsql
as $$
declare
  v_restaurant_id uuid;
begin
  select o.restaurant_id into v_restaurant_id
  from public.pos_orders o
  where o.id = new.order_id;

  if v_restaurant_id is null then
    raise exception 'pos_payments.order_id not found';
  end if;

  new.restaurant_id := v_restaurant_id;
  return new;
end;
$$;

create trigger pos_payments_sync_restaurant
  before insert or update of order_id on public.pos_payments
  for each row execute function public.pos_payments_sync_restaurant();

create or replace function public.pos_fiscal_transactions_sync_restaurant()
returns trigger
language plpgsql
as $$
declare
  v_restaurant_id uuid;
begin
  select o.restaurant_id into v_restaurant_id
  from public.pos_orders o
  where o.id = new.order_id;

  if v_restaurant_id is null then
    raise exception 'pos_fiscal_transactions.order_id not found';
  end if;

  new.restaurant_id := v_restaurant_id;
  return new;
end;
$$;

create trigger pos_fiscal_transactions_sync_restaurant
  before insert or update of order_id on public.pos_fiscal_transactions
  for each row execute function public.pos_fiscal_transactions_sync_restaurant();

create or replace function public.pos_table_sessions_enforce_dining_table_restaurant()
returns trigger
language plpgsql
as $$
declare
  v_table_restaurant uuid;
begin
  select dt.restaurant_id
  into v_table_restaurant
  from public.dining_tables dt
  where dt.id = new.dining_table_id;

  if v_table_restaurant is null then
    raise exception 'pos_table_sessions.dining_table_id not found';
  end if;

  if new.restaurant_id is distinct from v_table_restaurant then
    raise exception 'pos_table_sessions.restaurant_id must match dining table restaurant';
  end if;

  return new;
end;
$$;

create trigger pos_table_sessions_dining_table_restaurant
  before insert or update of dining_table_id, restaurant_id on public.pos_table_sessions
  for each row execute function public.pos_table_sessions_enforce_dining_table_restaurant();

-- ---------------------------------------------------------------------------
-- Realtime (Staff / KDS)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.pos_table_sessions;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.pos_orders;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.pos_payments;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
