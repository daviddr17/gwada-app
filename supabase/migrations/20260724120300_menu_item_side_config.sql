-- Phase 1: Beilagen-Preis + Side-Config pro Artikel (Prototyp sidePrice / includedCount).
-- Optionsgruppen bleiben menu_option_* (bereits vorhanden).

alter table public.menu_items
  add column if not exists side_price_cents bigint null;

alter table public.menu_items
  drop constraint if exists menu_items_side_price_cents_chk;

alter table public.menu_items
  add constraint menu_items_side_price_cents_chk
  check (side_price_cents is null or side_price_cents >= 0);

comment on column public.menu_items.side_price_cents is
  'Preis in Cent wenn als Beilage gewählt; null = voller Artikelpreis (price).';

create table if not exists public.menu_item_side_config (
  menu_item_id uuid primary key references public.menu_items (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  required boolean not null default false,
  max_sides integer not null default 1 check (max_sides >= 0 and max_sides <= 12),
  included_count integer not null default 0 check (included_count >= 0 and included_count <= 12),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint menu_item_side_config_included_lte_max
    check (included_count <= max_sides)
);

create index if not exists menu_item_side_config_restaurant_idx
  on public.menu_item_side_config (restaurant_id);

drop trigger if exists menu_item_side_config_set_updated_at on public.menu_item_side_config;
create trigger menu_item_side_config_set_updated_at
  before update on public.menu_item_side_config
  for each row execute function public.set_updated_at();

create or replace function public.menu_item_side_config_enforce_restaurant()
returns trigger
language plpgsql
as $$
declare
  item_rid uuid;
begin
  select restaurant_id into item_rid from public.menu_items where id = new.menu_item_id;
  if item_rid is null then
    raise exception 'menu_item_side_config: menu_item not found';
  end if;
  if new.restaurant_id is distinct from item_rid then
    raise exception 'menu_item_side_config.restaurant_id must match menu_items.restaurant_id';
  end if;
  return new;
end;
$$;

drop trigger if exists menu_item_side_config_restaurant on public.menu_item_side_config;
create trigger menu_item_side_config_restaurant
  before insert or update of menu_item_id, restaurant_id on public.menu_item_side_config
  for each row execute function public.menu_item_side_config_enforce_restaurant();

alter table public.menu_item_side_config enable row level security;

drop policy if exists menu_item_side_config_access on public.menu_item_side_config;
create policy menu_item_side_config_access
  on public.menu_item_side_config for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'));

comment on table public.menu_item_side_config is
  'Beilagen-Gruppe pro Hauptgericht: Pflicht, max, inklusive Anzahl.';
