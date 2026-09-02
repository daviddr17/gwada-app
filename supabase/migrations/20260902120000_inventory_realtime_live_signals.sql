-- Bestand / Bestellungen: Supabase Realtime + O(1) Live-Signal für Display-Poll.
-- Dashboard: postgres_changes → GWADA_INVENTORY_DATA_REFRESH (AppInventoryLive).
-- Display: GET live-signal liest nur restaurant_inventory_live_signals.revision.

create table if not exists public.restaurant_inventory_live_signals (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.restaurant_inventory_live_signals is
  'Monotonic revision bumped on any inventory/PO change — cheap live poll for Display kiosks.';

alter table public.restaurant_inventory_live_signals enable row level security;

create policy restaurant_inventory_live_signals_read_staff
  on public.restaurant_inventory_live_signals for select
  using (public.auth_is_restaurant_staff (restaurant_id));

create or replace function public.bump_restaurant_inventory_live_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  rid := coalesce(new.restaurant_id, old.restaurant_id);
  if rid is null then
    return coalesce(new, old);
  end if;

  insert into public.restaurant_inventory_live_signals (restaurant_id, revision, updated_at)
  values (rid, 1, now())
  on conflict (restaurant_id) do update
  set
    revision = public.restaurant_inventory_live_signals.revision + 1,
    updated_at = now();

  return coalesce(new, old);
end;
$$;

-- Ingredients / stock
drop trigger if exists inventory_ingredients_bump_live_signal on public.inventory_ingredients;
create trigger inventory_ingredients_bump_live_signal
  after insert or update or delete on public.inventory_ingredients
  for each row execute function public.bump_restaurant_inventory_live_signal();

drop trigger if exists inventory_stock_log_bump_live_signal on public.inventory_stock_log_entries;
create trigger inventory_stock_log_bump_live_signal
  after insert or update or delete on public.inventory_stock_log_entries
  for each row execute function public.bump_restaurant_inventory_live_signal();

-- Purchase orders
drop trigger if exists inventory_po_bump_live_signal on public.inventory_purchase_orders;
create trigger inventory_po_bump_live_signal
  after insert or update or delete on public.inventory_purchase_orders
  for each row execute function public.bump_restaurant_inventory_live_signal();

drop trigger if exists inventory_po_lines_bump_live_signal on public.inventory_purchase_order_lines;
create trigger inventory_po_lines_bump_live_signal
  after insert or update or delete on public.inventory_purchase_order_lines
  for each row execute function public.bump_restaurant_inventory_live_signal();

drop trigger if exists inventory_po_log_bump_live_signal on public.inventory_purchase_order_log_entries;
create trigger inventory_po_log_bump_live_signal
  after insert or update or delete on public.inventory_purchase_order_log_entries
  for each row execute function public.bump_restaurant_inventory_live_signal();

-- Realtime publication (self-hosted + cloud)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.inventory_ingredients;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.inventory_purchase_orders;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.inventory_purchase_order_lines;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.inventory_purchase_order_log_entries;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.restaurant_inventory_live_signals;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

alter table public.inventory_ingredients replica identity full;
alter table public.inventory_purchase_orders replica identity full;
alter table public.inventory_purchase_order_lines replica identity full;
alter table public.inventory_purchase_order_log_entries replica identity full;
alter table public.restaurant_inventory_live_signals replica identity full;
