-- Speisekarte: Optionen (z. B. Beilagen / Extras) mit wählbaren Positionen + Zuordnung zu Gerichten.
-- Für POS und spätere Online-Bestellung.

create table public.menu_option_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- 0 = Gruppe optional; >=1 = mindestens so viele Choices nötig
  min_select integer not null default 0 check (min_select >= 0),
  -- null = beliebig viele; sonst Obergrenze (>= min_select)
  max_select integer null check (max_select is null or max_select >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint menu_option_groups_select_range_check
    check (max_select is null or max_select >= min_select)
);

create index menu_option_groups_restaurant_sort_idx
  on public.menu_option_groups (restaurant_id, sort_order, name);

create trigger menu_option_groups_set_updated_at
  before update on public.menu_option_groups
  for each row execute function public.set_updated_at();

create table public.menu_option_choices (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.menu_option_groups (id) on delete cascade,
  name text not null,
  -- Aufpreis (0 = gratis / kein Aufpreis)
  price_delta numeric(10, 2) not null default 0 check (price_delta >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index menu_option_choices_group_sort_idx
  on public.menu_option_choices (option_group_id, sort_order, name);

create trigger menu_option_choices_set_updated_at
  before update on public.menu_option_choices
  for each row execute function public.set_updated_at();

create table public.menu_item_option_groups (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  option_group_id uuid not null references public.menu_option_groups (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (menu_item_id, option_group_id)
);

create index menu_item_option_groups_group_idx
  on public.menu_item_option_groups (option_group_id);

-- Restaurant der Gruppe muss zum Gericht passen
create or replace function public.enforce_menu_item_option_group_restaurant()
returns trigger
language plpgsql
as $$
declare
  item_rid uuid;
  group_rid uuid;
begin
  select restaurant_id into item_rid from public.menu_items where id = new.menu_item_id;
  select restaurant_id into group_rid from public.menu_option_groups where id = new.option_group_id;
  if item_rid is null or group_rid is null or item_rid <> group_rid then
    raise exception 'menu_item_option_groups: restaurant mismatch between item and option group';
  end if;
  return new;
end;
$$;

create trigger menu_item_option_groups_restaurant
  before insert or update on public.menu_item_option_groups
  for each row execute function public.enforce_menu_item_option_group_restaurant();

alter table public.menu_option_groups enable row level security;
alter table public.menu_option_choices enable row level security;
alter table public.menu_item_option_groups enable row level security;

create policy "menu_option_groups_access"
  on public.menu_option_groups for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'));

create policy "menu_option_choices_access"
  on public.menu_option_choices for all
  to authenticated
  using (
    exists (
      select 1 from public.menu_option_groups g
      where g.id = menu_option_choices.option_group_id
        and public.auth_has_restaurant_permission(g.restaurant_id, 'menu.manage')
    )
  )
  with check (
    exists (
      select 1 from public.menu_option_groups g
      where g.id = menu_option_choices.option_group_id
        and public.auth_has_restaurant_permission(g.restaurant_id, 'menu.manage')
    )
  );

create policy "menu_item_option_groups_access"
  on public.menu_item_option_groups for all
  to authenticated
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_option_groups.menu_item_id
        and public.auth_has_restaurant_permission(mi.restaurant_id, 'menu.manage')
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_option_groups.menu_item_id
        and public.auth_has_restaurant_permission(mi.restaurant_id, 'menu.manage')
    )
  );

comment on table public.menu_option_groups is
  'Wiederverwendbare Optionsgruppen (Beilagen, Extras, …) für Speisekarte/POS.';
comment on table public.menu_option_choices is
  'Wählbare Positionen innerhalb einer Optionsgruppe inkl. optionalem Aufpreis.';
comment on table public.menu_item_option_groups is
  'Zuordnung: welche Optionsgruppen an einem Gericht hängen.';
