-- Normalized English menu schema (per restaurant). Replaces JSON blobs in restaurant_app_state for menu data.
-- User profile fields extend public.profiles; restaurant membership stays in restaurant_employees.

-- ---------------------------------------------------------------------------
-- Profiles: optional structured fields (auth still lives in auth.users)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists given_name text;
alter table public.profiles
  add column if not exists family_name text;
alter table public.profiles
  add column if not exists birth_date date;
alter table public.profiles
  add column if not exists address_line1 text;
alter table public.profiles
  add column if not exists address_line2 text;
alter table public.profiles
  add column if not exists address_city text;
alter table public.profiles
  add column if not exists address_postal_code text;
alter table public.profiles
  add column if not exists address_country text default 'GP';

comment on column public.profiles.given_name is 'First name (English column name per project convention).';
comment on column public.profiles.family_name is 'Last name.';
comment on table public.restaurant_employees is 'Assigns authenticated users (profiles) to restaurants with a role; use this as the user↔restaurants list.';

-- ---------------------------------------------------------------------------
-- Menu tables
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index menu_categories_restaurant_sort_idx
  on public.menu_categories (restaurant_id, sort_order, name);

create trigger menu_categories_set_updated_at
  before update on public.menu_categories
  for each row execute function public.set_updated_at();

create table public.menu_tags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  background_color text not null default '#64748b',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index menu_tags_restaurant_sort_idx
  on public.menu_tags (restaurant_id, sort_order, name);

create trigger menu_tags_set_updated_at
  before update on public.menu_tags
  for each row execute function public.set_updated_at();

create table public.menu_allergens (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  background_color text not null default '#64748b',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index menu_allergens_restaurant_sort_idx
  on public.menu_allergens (restaurant_id, sort_order, name);

create trigger menu_allergens_set_updated_at
  before update on public.menu_allergens
  for each row execute function public.set_updated_at();

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0 check (price >= 0),
  image_url text not null default '',
  is_active boolean not null default true,
  list_number integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index menu_items_restaurant_category_idx
  on public.menu_items (restaurant_id, category_id);

create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

create or replace function public.enforce_menu_item_category_restaurant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.menu_categories c
    where c.id = new.category_id and c.restaurant_id = new.restaurant_id
  ) then
    raise exception 'menu_items.category_id must reference menu_categories for the same restaurant_id';
  end if;
  return new;
end;
$$;

create trigger menu_items_category_restaurant
  before insert or update on public.menu_items
  for each row execute function public.enforce_menu_item_category_restaurant();

create table public.menu_item_tags (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  tag_id uuid not null references public.menu_tags (id) on delete cascade,
  primary key (menu_item_id, tag_id)
);

create table public.menu_item_allergens (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  allergen_id uuid not null references public.menu_allergens (id) on delete cascade,
  primary key (menu_item_id, allergen_id)
);

create table public.menu_item_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  ingredient_id text not null,
  amount numeric(14, 4) not null check (amount > 0),
  sort_order integer not null default 0,
  unique (menu_item_id, ingredient_id)
);

create index menu_item_recipe_lines_item_idx
  on public.menu_item_recipe_lines (menu_item_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS: staff OR gwada-demo (local anon) — same idea as restaurant_app_state
-- ---------------------------------------------------------------------------
alter table public.menu_categories enable row level security;
alter table public.menu_tags enable row level security;
alter table public.menu_allergens enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_tags enable row level security;
alter table public.menu_item_allergens enable row level security;
alter table public.menu_item_recipe_lines enable row level security;

create policy "menu_categories_access"
  on public.menu_categories for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = menu_categories.restaurant_id and r.slug = 'gwada-demo'
    )
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = menu_categories.restaurant_id and r.slug = 'gwada-demo'
    )
  );

create policy "menu_tags_access"
  on public.menu_tags for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = menu_tags.restaurant_id and r.slug = 'gwada-demo'
    )
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = menu_tags.restaurant_id and r.slug = 'gwada-demo'
    )
  );

create policy "menu_allergens_access"
  on public.menu_allergens for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = menu_allergens.restaurant_id and r.slug = 'gwada-demo'
    )
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = menu_allergens.restaurant_id and r.slug = 'gwada-demo'
    )
  );

create policy "menu_items_access"
  on public.menu_items for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = menu_items.restaurant_id and r.slug = 'gwada-demo'
    )
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = menu_items.restaurant_id and r.slug = 'gwada-demo'
    )
  );

create policy "menu_item_tags_access"
  on public.menu_item_tags for all
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_tags.menu_item_id
        and (
          public.auth_is_restaurant_staff(mi.restaurant_id)
          or exists (
            select 1 from public.restaurants r
            where r.id = mi.restaurant_id and r.slug = 'gwada-demo'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_tags.menu_item_id
        and (
          public.auth_is_restaurant_staff(mi.restaurant_id)
          or exists (
            select 1 from public.restaurants r
            where r.id = mi.restaurant_id and r.slug = 'gwada-demo'
          )
        )
    )
  );

create policy "menu_item_allergens_access"
  on public.menu_item_allergens for all
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_allergens.menu_item_id
        and (
          public.auth_is_restaurant_staff(mi.restaurant_id)
          or exists (
            select 1 from public.restaurants r
            where r.id = mi.restaurant_id and r.slug = 'gwada-demo'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_allergens.menu_item_id
        and (
          public.auth_is_restaurant_staff(mi.restaurant_id)
          or exists (
            select 1 from public.restaurants r
            where r.id = mi.restaurant_id and r.slug = 'gwada-demo'
          )
        )
    )
  );

create policy "menu_item_recipe_lines_access"
  on public.menu_item_recipe_lines for all
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_recipe_lines.menu_item_id
        and (
          public.auth_is_restaurant_staff(mi.restaurant_id)
          or exists (
            select 1 from public.restaurants r
            where r.id = mi.restaurant_id and r.slug = 'gwada-demo'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_recipe_lines.menu_item_id
        and (
          public.auth_is_restaurant_staff(mi.restaurant_id)
          or exists (
            select 1 from public.restaurants r
            where r.id = mi.restaurant_id and r.slug = 'gwada-demo'
          )
        )
    )
  );
