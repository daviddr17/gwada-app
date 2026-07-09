-- Einkaufspreis pro Lagereinheit + Preishistorie (Food-Cost Grundlage)

alter table public.inventory_ingredients
  add column if not exists purchase_unit_price numeric(14, 4);

comment on column public.inventory_ingredients.purchase_unit_price is
  'Einkaufspreis (EUR) pro Lagereinheit (unit) — Basis für Food-Cost.';

create table public.inventory_ingredient_price_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  ingredient_id text not null,
  supplier_id text,
  unit_price numeric(14, 4) not null,
  unit text not null,
  effective_at timestamptz not null default now(),
  source text not null default 'manual',
  purchase_order_id text,
  purchase_order_line_id text,
  created_at timestamptz not null default now(),
  constraint inventory_ipe_fk_ingredient
    foreign key (restaurant_id, ingredient_id)
    references public.inventory_ingredients (restaurant_id, id)
    on delete cascade,
  constraint inventory_ipe_fk_supplier
    foreign key (restaurant_id, supplier_id)
    references public.inventory_suppliers (restaurant_id, id)
    on delete set null,
  constraint inventory_ipe_source_check
    check (source in ('manual', 'delivery', 'import', 'invoice'))
);

create index inventory_ipe_ingredient_effective_idx
  on public.inventory_ingredient_price_entries (restaurant_id, ingredient_id, effective_at desc);

comment on table public.inventory_ingredient_price_entries is
  'Preishistorie pro Zutat (EK pro Lagereinheit zum Zeitpunkt effective_at).';

-- Preisänderung → Historieneintrag (manuell / RPC-Upsert)
create or replace function public.trg_inventory_ingredient_price_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.purchase_unit_price is not null then
      insert into public.inventory_ingredient_price_entries (
        restaurant_id, ingredient_id, supplier_id, unit_price, unit, effective_at, source
      ) values (
        new.restaurant_id,
        new.id,
        new.supplier_id,
        new.purchase_unit_price,
        new.unit,
        now(),
        'manual'
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.purchase_unit_price is distinct from old.purchase_unit_price
      and new.purchase_unit_price is not null then
      insert into public.inventory_ingredient_price_entries (
        restaurant_id, ingredient_id, supplier_id, unit_price, unit, effective_at, source
      ) values (
        new.restaurant_id,
        new.id,
        new.supplier_id,
        new.purchase_unit_price,
        new.unit,
        now(),
        'manual'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_ingredients_price_history
  on public.inventory_ingredients;

create trigger inventory_ingredients_price_history
  after insert or update of purchase_unit_price on public.inventory_ingredients
  for each row
  execute function public.trg_inventory_ingredient_price_history();

-- RPC: purchase_unit_price mitspeichern
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
  keep_ids text[] := array[]::text[];
  v_price numeric(14, 4);
begin
  for ing in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    keep_ids := array_append(keep_ids, ing->>'id');
  end loop;

  delete from public.inventory_stock_log_entries
  where restaurant_id = p_restaurant_id
    and ingredient_id <> all (coalesce(keep_ids, array[]::text[]));

  delete from public.inventory_ingredients
  where restaurant_id = p_restaurant_id
    and id <> all (coalesce(keep_ids, array[]::text[]));

  for ing in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    v_price := null;
    if ing ? 'purchaseUnitPrice' and ing->>'purchaseUnitPrice' is not null
      and btrim(ing->>'purchaseUnitPrice') <> '' then
      v_price := (ing->>'purchaseUnitPrice')::numeric(14, 4);
    end if;

    insert into public.inventory_ingredients (
      restaurant_id, id, name, unit, current_stock, low_stock_threshold,
      supplier_id, category_id, production_site_id, brand_id, is_active,
      purchase_unit_price
    ) values (
      p_restaurant_id,
      ing->>'id',
      ing->>'name',
      ing->>'unit',
      coalesce((ing->>'currentStock')::numeric, 0),
      coalesce((ing->>'lowStockThreshold')::numeric, 0),
      ing->>'supplierId',
      ing->>'categoryId',
      ing->>'productionSiteId',
      ing->>'brandId',
      case when (ing ? 'active' and ing->'active' = 'false'::jsonb) then false else true end,
      v_price
    )
    on conflict (restaurant_id, id) do update set
      name = excluded.name,
      unit = excluded.unit,
      current_stock = excluded.current_stock,
      low_stock_threshold = excluded.low_stock_threshold,
      supplier_id = excluded.supplier_id,
      category_id = excluded.category_id,
      production_site_id = excluded.production_site_id,
      brand_id = excluded.brand_id,
      is_active = excluded.is_active,
      purchase_unit_price = excluded.purchase_unit_price;

    delete from public.inventory_stock_log_entries
    where restaurant_id = p_restaurant_id
      and ingredient_id = ing->>'id';

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

alter table public.inventory_ingredient_price_entries enable row level security;

drop policy if exists "inventory_ingredient_price_entries_access"
  on public.inventory_ingredient_price_entries;

create policy "inventory_ingredient_price_entries_access"
  on public.inventory_ingredient_price_entries for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));
