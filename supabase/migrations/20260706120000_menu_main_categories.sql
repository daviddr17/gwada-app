-- Hauptkategorien (Speisen / Getränke / …) pro Restaurant; Kategorien gehören zu einer Hauptkategorie.

create table public.menu_main_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index menu_main_categories_restaurant_sort_idx
  on public.menu_main_categories (restaurant_id, sort_order, name);

create trigger menu_main_categories_set_updated_at
  before update on public.menu_main_categories
  for each row execute function public.set_updated_at();

alter table public.menu_categories
  add column main_category_id uuid references public.menu_main_categories (id) on delete restrict;

-- Backfill: pro Restaurant Speisen + Getränke, Kategorien zuordnen
do $$
declare
  r record;
  v_food_id uuid;
  v_beverage_id uuid;
begin
  for r in select id from public.restaurants loop
    insert into public.menu_main_categories (restaurant_id, name, sort_order, is_active)
    values (r.id, 'Speisen', 0, true)
    returning id into v_food_id;

    insert into public.menu_main_categories (restaurant_id, name, sort_order, is_active)
    values (r.id, 'Getränke', 1, true)
    returning id into v_beverage_id;

    update public.menu_categories c
    set main_category_id = v_beverage_id
    where c.restaurant_id = r.id
      and (
        lower(trim(c.name)) like '%getränk%'
        or lower(trim(c.name)) like '%drink%'
        or lower(trim(c.name)) in ('boissons', 'beverages', 'getränke')
      );

    update public.menu_categories c
    set main_category_id = v_food_id
    where c.restaurant_id = r.id
      and c.main_category_id is null;
  end loop;
end $$;

alter table public.menu_categories
  alter column main_category_id set not null;

create index menu_categories_main_category_idx
  on public.menu_categories (main_category_id, sort_order);

-- RLS (gleiches Modell wie menu_categories)
alter table public.menu_main_categories enable row level security;

drop policy if exists "menu_main_categories_access" on public.menu_main_categories;
create policy "menu_main_categories_access"
  on public.menu_main_categories for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'));

comment on table public.menu_main_categories is
  'Top-level menu grouping (e.g. Speisen, Getränke). Categories belong to one main category.';

-- Neue Restaurants: Standard-Hauptkategorien anlegen
create or replace function public.seed_menu_main_categories_for_restaurant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.menu_main_categories (restaurant_id, name, sort_order, is_active)
  values
    (new.id, 'Speisen', 0, true),
    (new.id, 'Getränke', 1, true);
  return new;
end;
$$;

drop trigger if exists restaurants_seed_menu_main_categories on public.restaurants;
create trigger restaurants_seed_menu_main_categories
  after insert on public.restaurants
  for each row execute function public.seed_menu_main_categories_for_restaurant();
