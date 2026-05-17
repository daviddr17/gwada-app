-- Normalized inventory (Bestand) + purchase orders (Bestellungen), scoped by restaurant_id.
-- String ids (e.g. ing-1, sup-1) match app seeds; composite PK (restaurant_id, id).

-- ---------------------------------------------------------------------------
-- Taxonomy tables (suppliers, brands, …)
-- ---------------------------------------------------------------------------
create table public.inventory_suppliers (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  id text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, id)
);

create trigger inventory_suppliers_set_updated_at
  before update on public.inventory_suppliers
  for each row execute function public.set_updated_at();

create table public.inventory_brands (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  id text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, id)
);

create trigger inventory_brands_set_updated_at
  before update on public.inventory_brands
  for each row execute function public.set_updated_at();

create table public.inventory_ingredient_categories (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  id text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, id)
);

create trigger inventory_ingredient_categories_set_updated_at
  before update on public.inventory_ingredient_categories
  for each row execute function public.set_updated_at();

create table public.inventory_production_sites (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  id text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, id)
);

create trigger inventory_production_sites_set_updated_at
  before update on public.inventory_production_sites
  for each row execute function public.set_updated_at();

create table public.inventory_units (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  id text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, id)
);

create trigger inventory_units_set_updated_at
  before update on public.inventory_units
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ingredients + stock log (entry = full JSON object as in localStorage)
-- ---------------------------------------------------------------------------
create table public.inventory_ingredients (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  id text not null,
  name text not null,
  unit text not null,
  current_stock numeric(14, 4) not null default 0,
  supplier_id text not null,
  category_id text not null,
  production_site_id text not null,
  brand_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, id),
  constraint inventory_ingredients_fk_unit
    foreign key (restaurant_id, unit) references public.inventory_units (restaurant_id, id),
  constraint inventory_ingredients_fk_supplier
    foreign key (restaurant_id, supplier_id) references public.inventory_suppliers (restaurant_id, id),
  constraint inventory_ingredients_fk_category
    foreign key (restaurant_id, category_id) references public.inventory_ingredient_categories (restaurant_id, id),
  constraint inventory_ingredients_fk_site
    foreign key (restaurant_id, production_site_id) references public.inventory_production_sites (restaurant_id, id),
  constraint inventory_ingredients_fk_brand
    foreign key (restaurant_id, brand_id) references public.inventory_brands (restaurant_id, id)
);

create trigger inventory_ingredients_set_updated_at
  before update on public.inventory_ingredients
  for each row execute function public.set_updated_at();

create index inventory_ingredients_restaurant_name_idx
  on public.inventory_ingredients (restaurant_id, name);

create table public.inventory_stock_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  ingredient_id text not null,
  seq integer not null,
  entry jsonb not null,
  unique (restaurant_id, ingredient_id, seq),
  constraint inventory_stock_log_fk_ingredient
    foreign key (restaurant_id, ingredient_id)
    references public.inventory_ingredients (restaurant_id, id)
    on delete cascade
);

create index inventory_stock_log_restaurant_ingredient_idx
  on public.inventory_stock_log_entries (restaurant_id, ingredient_id, seq);

-- ---------------------------------------------------------------------------
-- Purchase orders (separate from dining public.orders)
-- ---------------------------------------------------------------------------
create table public.inventory_purchase_orders (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  id text not null,
  supplier_id text not null,
  supplier_name text not null,
  status text not null check (status in ('open', 'closed')),
  created_at timestamptz not null,
  created_by text not null default '',
  created_by_user_source text,
  delivery_date date,
  primary key (restaurant_id, id),
  constraint inventory_po_fk_supplier
    foreign key (restaurant_id, supplier_id) references public.inventory_suppliers (restaurant_id, id)
);

create index inventory_po_restaurant_status_idx
  on public.inventory_purchase_orders (restaurant_id, status, created_at desc);

create table public.inventory_purchase_order_lines (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id text not null,
  id text not null,
  ingredient_id text not null,
  ingredient_name text not null,
  brand_label text,
  quantity numeric(14, 4) not null,
  unit_id text not null,
  unit_label text not null,
  delivered_at timestamptz,
  primary key (restaurant_id, order_id, id),
  constraint inventory_pol_fk_order
    foreign key (restaurant_id, order_id)
    references public.inventory_purchase_orders (restaurant_id, id)
    on delete cascade
);

create table public.inventory_purchase_order_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id text not null,
  sort_order integer not null,
  entry jsonb not null,
  unique (restaurant_id, order_id, sort_order),
  constraint inventory_polog_fk_order
    foreign key (restaurant_id, order_id)
    references public.inventory_purchase_orders (restaurant_id, id)
    on delete cascade
);

-- ---------------------------------------------------------------------------
-- Atomic replace RPCs (SECURITY DEFINER — bypass RLS inside transaction)
-- ---------------------------------------------------------------------------
create or replace function public.inventory_replace_ingredients(
  p_restaurant_id uuid,
  p_ingredients jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ing jsonb;
  ent jsonb;
  s int;
begin
  delete from public.inventory_stock_log_entries where restaurant_id = p_restaurant_id;
  delete from public.inventory_ingredients where restaurant_id = p_restaurant_id;

  for ing in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.inventory_ingredients (
      restaurant_id, id, name, unit, current_stock,
      supplier_id, category_id, production_site_id, brand_id, is_active
    ) values (
      p_restaurant_id,
      ing->>'id',
      ing->>'name',
      ing->>'unit',
      coalesce((ing->>'currentStock')::numeric, 0),
      ing->>'supplierId',
      ing->>'categoryId',
      ing->>'productionSiteId',
      ing->>'brandId',
      case when (ing ? 'active' and ing->'active' = 'false'::jsonb) then false else true end
    );

    s := 0;
    for ent in select * from jsonb_array_elements(coalesce(ing->'stockLog', '[]'::jsonb))
    loop
      insert into public.inventory_stock_log_entries (restaurant_id, ingredient_id, seq, entry)
      values (p_restaurant_id, ing->>'id', s, ent);
      s := s + 1;
    end loop;
  end loop;
end;
$$;

create or replace function public.inventory_replace_purchase_orders(
  p_restaurant_id uuid,
  p_orders jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ord jsonb;
  ln jsonb;
  lg jsonb;
  s int;
  dd date;
begin
  delete from public.inventory_purchase_order_log_entries where restaurant_id = p_restaurant_id;
  delete from public.inventory_purchase_order_lines where restaurant_id = p_restaurant_id;
  delete from public.inventory_purchase_orders where restaurant_id = p_restaurant_id;

  for ord in select * from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb))
  loop
    dd := null;
    if ord ? 'deliveryDate' and nullif(trim(ord->>'deliveryDate'), '') is not null then
      dd := (ord->>'deliveryDate')::date;
    end if;

    insert into public.inventory_purchase_orders (
      restaurant_id, id, supplier_id, supplier_name, status,
      created_at, created_by, created_by_user_source, delivery_date
    ) values (
      p_restaurant_id,
      ord->>'id',
      ord->>'supplierId',
      ord->>'supplierName',
      ord->>'status',
      coalesce((ord->>'createdAt')::timestamptz, timezone('utc', now())),
      coalesce(ord->>'createdBy', ''),
      nullif(ord->>'createdByUserSource', ''),
      dd
    );

    for ln in select * from jsonb_array_elements(coalesce(ord->'lines', '[]'::jsonb))
    loop
      insert into public.inventory_purchase_order_lines (
        restaurant_id, order_id, id, ingredient_id, ingredient_name, brand_label,
        quantity, unit_id, unit_label, delivered_at
      ) values (
        p_restaurant_id,
        ord->>'id',
        ln->>'id',
        ln->>'ingredientId',
        ln->>'ingredientName',
        nullif(ln->>'brandLabel', ''),
        (ln->>'quantity')::numeric,
        ln->>'unitId',
        ln->>'unitLabel',
        case
          when nullif(trim(ln->>'deliveredAt'), '') is null then null
          else (ln->>'deliveredAt')::timestamptz
        end
      );
    end loop;

    s := 0;
    for lg in select * from jsonb_array_elements(coalesce(ord->'log', '[]'::jsonb))
    loop
      insert into public.inventory_purchase_order_log_entries (restaurant_id, order_id, sort_order, entry)
      values (p_restaurant_id, ord->>'id', s, lg);
      s := s + 1;
    end loop;
  end loop;
end;
$$;

revoke all on function public.inventory_replace_ingredients(uuid, jsonb) from public;
grant execute on function public.inventory_replace_ingredients(uuid, jsonb) to anon, authenticated, service_role;

revoke all on function public.inventory_replace_purchase_orders(uuid, jsonb) from public;
grant execute on function public.inventory_replace_purchase_orders(uuid, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS (staff or gwada-demo — same pattern as menu_*)
-- ---------------------------------------------------------------------------
alter table public.inventory_suppliers enable row level security;
alter table public.inventory_brands enable row level security;
alter table public.inventory_ingredient_categories enable row level security;
alter table public.inventory_production_sites enable row level security;
alter table public.inventory_units enable row level security;
alter table public.inventory_ingredients enable row level security;
alter table public.inventory_stock_log_entries enable row level security;
alter table public.inventory_purchase_orders enable row level security;
alter table public.inventory_purchase_order_lines enable row level security;
alter table public.inventory_purchase_order_log_entries enable row level security;

create policy "inventory_suppliers_access"
  on public.inventory_suppliers for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_suppliers.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_suppliers.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_brands_access"
  on public.inventory_brands for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_brands.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_brands.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_ingredient_categories_access"
  on public.inventory_ingredient_categories for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_ingredient_categories.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_ingredient_categories.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_production_sites_access"
  on public.inventory_production_sites for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_production_sites.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_production_sites.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_units_access"
  on public.inventory_units for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_units.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_units.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_ingredients_access"
  on public.inventory_ingredients for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_ingredients.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_ingredients.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_stock_log_access"
  on public.inventory_stock_log_entries for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_stock_log_entries.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_stock_log_entries.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_purchase_orders_access"
  on public.inventory_purchase_orders for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_purchase_orders.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_purchase_orders.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_purchase_order_lines_access"
  on public.inventory_purchase_order_lines for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_purchase_order_lines.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_purchase_order_lines.restaurant_id and r.slug = 'gwada-demo')
  );

create policy "inventory_purchase_order_log_access"
  on public.inventory_purchase_order_log_entries for all
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_purchase_order_log_entries.restaurant_id and r.slug = 'gwada-demo')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = inventory_purchase_order_log_entries.restaurant_id and r.slug = 'gwada-demo')
  );
