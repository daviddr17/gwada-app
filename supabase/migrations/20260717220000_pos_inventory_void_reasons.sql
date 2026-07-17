-- POS: optional inventory booking on KDS status + configurable void reasons

create table if not exists public.restaurant_pos_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  inventory_booking_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurant_pos_settings_set_updated_at
  before update on public.restaurant_pos_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_pos_settings enable row level security;

drop policy if exists "restaurant_pos_settings_access" on public.restaurant_pos_settings;
create policy "restaurant_pos_settings_access"
  on public.restaurant_pos_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

alter table public.pos_kds_statuses
  add column if not exists deduct_inventory_on_enter boolean not null default false;

comment on column public.pos_kds_statuses.deduct_inventory_on_enter is
  'When restaurant POS inventory booking is enabled, deduct recipe stock on entering this status.';

create table if not exists public.pos_void_reasons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  restore_inventory boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pos_void_reasons_restaurant_sort_idx
  on public.pos_void_reasons (restaurant_id, sort_order, name);

create trigger pos_void_reasons_set_updated_at
  before update on public.pos_void_reasons
  for each row execute function public.set_updated_at();

alter table public.pos_void_reasons enable row level security;

drop policy if exists "pos_void_reasons_access" on public.pos_void_reasons;
create policy "pos_void_reasons_access"
  on public.pos_void_reasons for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

alter table public.pos_orders
  add column if not exists inventory_deducted_at timestamptz null,
  add column if not exists inventory_deducted_kds_status_id uuid null
    references public.pos_kds_statuses (id) on delete set null,
  add column if not exists inventory_restored_at timestamptz null;

alter table public.pos_payments
  add column if not exists void_reason_id uuid null
    references public.pos_void_reasons (id) on delete set null,
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by_profile_id uuid null
    references public.profiles (id) on delete set null;

-- Default void reasons for restaurants that already use POS
insert into public.pos_void_reasons (
  restaurant_id, name, restore_inventory, sort_order
)
select
  r.id,
  v.name,
  v.restore_inventory,
  v.sort_order
from public.restaurants r
cross join (
  values
    ('Falsch bestellt', true, 0),
    ('Gast storniert', true, 1),
    ('Bereits ausgegeben', false, 2),
    ('Test / Fehlbuchung', true, 3)
) as v(name, restore_inventory, sort_order)
where
  (
    exists (select 1 from public.pos_orders o where o.restaurant_id = r.id)
    or exists (select 1 from public.pos_kds_devices d where d.restaurant_id = r.id)
    or exists (select 1 from public.pos_kds_statuses s where s.restaurant_id = r.id)
  )
  and not exists (
    select 1 from public.pos_void_reasons vr where vr.restaurant_id = r.id
  );
