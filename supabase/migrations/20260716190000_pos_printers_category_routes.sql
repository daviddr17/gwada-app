-- POS: Bondrucker-Registry + Kategorie-Routing (KDS / Drucker / beide / keines)

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'pos_route_destination'
  ) then
    create type public.pos_route_destination as enum (
      'kds',
      'printer',
      'both',
      'none'
    );
  end if;
end $$;

-- Bondrucker (ESC/POS später; connection_config speichert Host/Port/MAC)
create table if not exists public.pos_printers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  -- virtual | network | bluetooth | usb | airprint
  connection_type text not null default 'virtual',
  connection_config jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pos_printers_connection_type_check
    check (connection_type in ('virtual', 'network', 'bluetooth', 'usb', 'airprint'))
);

create index if not exists pos_printers_restaurant_sort_idx
  on public.pos_printers (restaurant_id, sort_order, name);

create trigger pos_printers_set_updated_at
  before update on public.pos_printers
  for each row execute function public.set_updated_at();

alter table public.pos_printers enable row level security;

drop policy if exists "pos_printers_access" on public.pos_printers;
create policy "pos_printers_access"
  on public.pos_printers for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- Pro Speisekarten-Kategorie: wohin geht der Küchen-Bon?
create table if not exists public.pos_category_routes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_category_id uuid not null references public.menu_categories (id) on delete cascade,
  destination public.pos_route_destination not null default 'kds',
  -- leer = alle aktiven Geräte/Drucker der jeweiligen Art
  kds_device_ids uuid[] not null default '{}',
  printer_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, menu_category_id)
);

create index if not exists pos_category_routes_restaurant_idx
  on public.pos_category_routes (restaurant_id);

create trigger pos_category_routes_set_updated_at
  before update on public.pos_category_routes
  for each row execute function public.set_updated_at();

alter table public.pos_category_routes enable row level security;

drop policy if exists "pos_category_routes_access" on public.pos_category_routes;
create policy "pos_category_routes_access"
  on public.pos_category_routes for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_printers is 'POS Bondrucker / Küchendrucker (LAN/Bluetooth/USB; virtual = Queue ohne Hardware)';
comment on table public.pos_category_routes is 'Routing Speisekarten-Kategorie → KDS, Drucker, beide oder kein Bon';
