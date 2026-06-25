-- gwada.app core schema: restaurants, staff, floor plan, reservations, orders
-- Requires Supabase Auth (auth.users).

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'employee_role') then
    create type public.employee_role as enum (
      'owner',
      'manager',
      'host',
      'server',
      'kitchen',
      'other'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type public.reservation_status as enum (
      'pending',
      'confirmed',
      'seated',
      'completed',
      'cancelled',
      'no_show'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'draft',
      'open',
      'in_kitchen',
      'ready',
      'served',
      'paid',
      'cancelled'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- Self-hosted Supabase Docker may ship public.profiles before gwada migrations.
-- RENAME statt DROP — DROP kann „cache lookup failed“ auf frischem Supabase-Stack auslösen.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

do $gwada_drop_supabase_profiles$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop trigger if exists profiles_set_updated_at on public.profiles';
    execute 'alter table public.profiles rename to _supabase_bootstrap_profiles';
  end if;
end $gwada_drop_supabase_profiles$;

drop function if exists public.handle_new_user() cascade;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  locale text default 'fr-GP',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Restaurants & staff
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  timezone text not null default 'America/Guadeloupe',
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country text default 'GP',
  phone text,
  email text,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

create table public.restaurant_employees (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.employee_role not null default 'other',
  is_active boolean not null default true,
  hired_at date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, profile_id)
);

create trigger restaurant_employees_set_updated_at
  before update on public.restaurant_employees
  for each row execute function public.set_updated_at();

-- Physical dining tables (not SQL "table")
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label text not null,
  capacity integer not null default 2 check (capacity > 0 and capacity <= 50),
  floor text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, label)
);

create trigger dining_tables_set_updated_at
  before update on public.dining_tables
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  dining_table_id uuid references public.dining_tables (id) on delete set null,
  guest_profile_id uuid references public.profiles (id) on delete set null,
  guest_name text,
  guest_email text,
  guest_phone text,
  party_size integer not null default 2 check (party_size > 0 and party_size <= 50),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.reservation_status not null default 'pending',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at)
);

create index reservations_restaurant_starts_idx
  on public.reservations (restaurant_id, starts_at);

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  dining_table_id uuid references public.dining_tables (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  opened_by_profile_id uuid references public.profiles (id) on delete set null,
  status public.order_status not null default 'draft',
  currency char(3) not null default 'EUR',
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  notes text,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index orders_restaurant_created_idx
  on public.orders (restaurant_id, created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  name text not null,
  sku text,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price_cents bigint not null default 0,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index order_items_order_idx on public.order_items (order_id, position);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_employees enable row level security;
alter table public.dining_tables enable row level security;
alter table public.reservations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles: own row only
create policy "profiles_select_own"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- Restaurants: published visible to everyone; unpublished only staff
create policy "restaurants_select_public_or_staff"
  on public.restaurants for select
  using (
    is_published
    or (select auth.uid()) = owner_profile_id
    or exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurants.id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );

create policy "restaurants_insert_authenticated_owner"
  on public.restaurants for insert
  with check (
    (select auth.role()) = 'authenticated'
    and owner_profile_id = (select auth.uid())
  );

create policy "restaurants_update_owner_or_manager"
  on public.restaurants for update
  using (
    (select auth.uid()) = owner_profile_id
    or exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurants.id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.role in ('owner', 'manager')
    )
  );

-- Employees: self + coworkers at same restaurant (read); managers manage
create policy "restaurant_employees_select_same_restaurant"
  on public.restaurant_employees for select
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurant_employees.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );

create policy "restaurant_employees_insert_as_restaurant_owner"
  on public.restaurant_employees for insert
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id
        and r.owner_profile_id = (select auth.uid())
    )
  );

create policy "restaurant_employees_insert_by_manager"
  on public.restaurant_employees for insert
  with check (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurant_employees.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.role in ('owner', 'manager')
    )
  );

create policy "restaurant_employees_update_managers"
  on public.restaurant_employees for update
  using (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurant_employees.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.role in ('owner', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurant_employees.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.role in ('owner', 'manager')
    )
  );

create policy "restaurant_employees_delete_managers"
  on public.restaurant_employees for delete
  using (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurant_employees.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.role in ('owner', 'manager')
    )
  );

-- Dining tables: staff of restaurant
create policy "dining_tables_select_staff"
  on public.dining_tables for select
  using (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = dining_tables.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
    or exists (
      select 1 from public.restaurants r
      where r.id = dining_tables.restaurant_id
        and r.is_published
    )
  );

create policy "dining_tables_write_staff"
  on public.dining_tables for all
  using (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = dining_tables.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.role in ('owner', 'manager', 'host')
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = dining_tables.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.role in ('owner', 'manager', 'host')
    )
  );

-- Reservations: guest sees own; staff sees restaurant
create policy "reservations_select_guest_or_staff"
  on public.reservations for select
  using (
    guest_profile_id = (select auth.uid())
    or exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = reservations.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );

create policy "reservations_insert_guest_or_staff"
  on public.reservations for insert
  with check (
    guest_profile_id is null
    or guest_profile_id = (select auth.uid())
    or exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = reservations.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );

create policy "reservations_update_staff_or_guest"
  on public.reservations for update
  using (
    guest_profile_id = (select auth.uid())
    or exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = reservations.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );

-- Orders: staff full access; guests could be extended later
create policy "orders_select_staff"
  on public.orders for select
  using (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = orders.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );

create policy "orders_write_staff"
  on public.orders for all
  using (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = orders.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = orders.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );

create policy "order_items_access_via_order"
  on public.order_items for all
  using (
    exists (
      select 1 from public.orders o
      join public.restaurant_employees re
        on re.restaurant_id = o.restaurant_id
      where o.id = order_items.order_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      join public.restaurant_employees re
        on re.restaurant_id = o.restaurant_id
      where o.id = order_items.order_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );
