-- Configurable KDS workflow statuses (name, color, order, print-on-enter)

create table if not exists public.pos_kds_statuses (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  sort_order integer not null default 0,
  print_on_enter boolean not null default false,
  -- Empty = all active printers that category routing would use (or all active printers)
  printer_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pos_kds_statuses_color_hex_chk
    check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create index if not exists pos_kds_statuses_restaurant_sort_idx
  on public.pos_kds_statuses (restaurant_id, sort_order, name);

create trigger pos_kds_statuses_set_updated_at
  before update on public.pos_kds_statuses
  for each row execute function public.set_updated_at();

alter table public.pos_kds_statuses enable row level security;

drop policy if exists "pos_kds_statuses_access" on public.pos_kds_statuses;
create policy "pos_kds_statuses_access"
  on public.pos_kds_statuses for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

alter table public.pos_orders
  add column if not exists kds_status_id uuid null
    references public.pos_kds_statuses (id) on delete set null;

create index if not exists pos_orders_kds_status_idx
  on public.pos_orders (restaurant_id, kds_status_id)
  where kds_status_id is not null;

comment on table public.pos_kds_statuses is
  'Kitchen Display workflow stages: tap advances; optional Bondruck on enter.';
comment on column public.pos_orders.kds_status_id is
  'Current KDS stage; null = left the kitchen board.';

-- Default stages for restaurants that already use POS / KDS
insert into public.pos_kds_statuses (
  restaurant_id, name, color, sort_order, print_on_enter
)
select
  r.id,
  v.name,
  v.color,
  v.sort_order,
  false
from public.restaurants r
cross join (
  values
    ('Neu', '#3b82f6', 0),
    ('In Zubereitung', '#f97316', 1),
    ('Fertig', '#22c55e', 2)
) as v(name, color, sort_order)
where
  (
    exists (
      select 1 from public.pos_orders o where o.restaurant_id = r.id
    )
    or exists (
      select 1 from public.pos_kds_devices d where d.restaurant_id = r.id
    )
  )
  and not exists (
    select 1 from public.pos_kds_statuses s where s.restaurant_id = r.id
  );

-- Backfill open kitchen tickets onto matching default stages
update public.pos_orders o
set kds_status_id = s.id
from public.pos_kds_statuses s
where
  o.restaurant_id = s.restaurant_id
  and o.kds_status_id is null
  and o.status in ('received', 'preparing', 'ready')
  and s.sort_order = case o.status
    when 'ready' then 2
    when 'preparing' then 1
    else 0
  end;
