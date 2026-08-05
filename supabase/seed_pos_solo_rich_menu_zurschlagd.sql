-- Dev-only: POS Solo rich menu for zurschlagd (Beilagen + recipe + side_config).
-- Idempotent. Skip if restaurant missing. Do NOT run against Live.

do $$
declare
  rid uuid;
  cat_beilagen uuid;
  cat_haupt uuid;
  main_id uuid;
  pommes_id uuid := 'a8e40000-0000-4000-8000-000000000001';
  kroketten_id uuid := 'a8e40000-0000-4000-8000-000000000002';
  unit_id text;
  sup_id text;
  ic_id text;
  ps_id text;
  br_id text;
begin
  select id into rid from public.restaurants where slug = 'zurschlagd' limit 1;
  if rid is null then
    raise notice 'seed_pos_solo_rich_menu: zurschlagd missing — skip';
    return;
  end if;

  -- Beilagen category (reuse by name)
  select id into cat_beilagen
  from public.menu_categories
  where restaurant_id = rid
    and lower(name) = 'beilagen'
  limit 1;

  if cat_beilagen is null then
    cat_beilagen := 'a8e40000-0000-4000-8000-000000000010';
    insert into public.menu_categories (id, restaurant_id, name, sort_order, is_active)
    values (cat_beilagen, rid, 'Beilagen', 50, true)
    on conflict (id) do update set name = excluded.name, is_active = true;
  end if;

  -- Pommes: reuse existing active row by name, else insert stable UUID
  select id into pommes_id
  from public.menu_items
  where restaurant_id = rid
    and is_active
    and lower(name) = 'pommes'
  limit 1;

  if pommes_id is null then
    pommes_id := 'a8e40000-0000-4000-8000-000000000001';
    insert into public.menu_items (
      id, restaurant_id, category_id, name, description, price, side_price_cents, is_active, list_number
    ) values
      (pommes_id, rid, cat_beilagen, 'Pommes', '', 4.50, 450, true, 1)
    on conflict (id) do update set
      category_id = excluded.category_id,
      name = excluded.name,
      price = excluded.price,
      side_price_cents = excluded.side_price_cents,
      is_active = true,
      list_number = excluded.list_number;
  else
    update public.menu_items set
      category_id = cat_beilagen,
      price = 4.50,
      side_price_cents = 450,
      is_active = true,
      list_number = 1
    where id = pommes_id;
  end if;

  -- Kroketten: reuse existing active row by name, else insert stable UUID
  select id into kroketten_id
  from public.menu_items
  where restaurant_id = rid
    and is_active
    and lower(name) = 'kroketten'
  limit 1;

  if kroketten_id is null then
    kroketten_id := 'a8e40000-0000-4000-8000-000000000002';
    insert into public.menu_items (
      id, restaurant_id, category_id, name, description, price, side_price_cents, is_active, list_number
    ) values
      (kroketten_id, rid, cat_beilagen, 'Kroketten', '', 4.90, 490, true, 2)
    on conflict (id) do update set
      category_id = excluded.category_id,
      name = excluded.name,
      price = excluded.price,
      side_price_cents = excluded.side_price_cents,
      is_active = true,
      list_number = excluded.list_number;
  else
    update public.menu_items set
      category_id = cat_beilagen,
      price = 4.90,
      side_price_cents = 490,
      is_active = true,
      list_number = 2
    where id = kroketten_id;
  end if;

  -- Prefer Schnitzel Haupt; else first active Hauptgerichte item
  select id into main_id
  from public.menu_items mi
  join public.menu_categories mc on mc.id = mi.category_id
  where mi.restaurant_id = rid
    and mi.is_active
    and mi.name ilike '%schnitzel%'
  order by mi.name
  limit 1;

  if main_id is null then
    select mc.id into cat_haupt
    from public.menu_categories mc
    where mc.restaurant_id = rid and lower(mc.name) = 'hauptgerichte'
    limit 1;

    if cat_haupt is not null then
      select mi.id into main_id
      from public.menu_items mi
      where mi.restaurant_id = rid and mi.category_id = cat_haupt and mi.is_active
      order by mi.list_number nulls last, mi.name
      limit 1;
    end if;
  end if;

  if main_id is null then
    raise notice 'seed_pos_solo_rich_menu: no Haupt for side/recipe — skip config';
  else
    insert into public.menu_item_side_config (
      menu_item_id, restaurant_id, required, max_sides, included_count
    ) values (main_id, rid, false, 2, 1)
    on conflict (menu_item_id) do update set
      required = excluded.required,
      max_sides = excluded.max_sides,
      included_count = excluded.included_count,
      restaurant_id = excluded.restaurant_id;

    -- Minimal inventory taxonomy (only if we can attach FKs)
    select id into unit_id from public.inventory_units where restaurant_id = rid limit 1;
    select id into sup_id from public.inventory_suppliers where restaurant_id = rid limit 1;
    select id into ic_id from public.inventory_ingredient_categories where restaurant_id = rid limit 1;
    select id into ps_id from public.inventory_production_sites where restaurant_id = rid limit 1;
    select id into br_id from public.inventory_brands where restaurant_id = rid limit 1;

    if unit_id is null then
      insert into public.inventory_units (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-g', 'Gramm (g)', 0, true)
      on conflict (restaurant_id, id) do nothing;
      unit_id := 'pos-solo-g';
    end if;
    if sup_id is null then
      insert into public.inventory_suppliers (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-sup', 'POS Solo', 0, true)
      on conflict (restaurant_id, id) do nothing;
      sup_id := 'pos-solo-sup';
    end if;
    if ic_id is null then
      insert into public.inventory_ingredient_categories (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-ic', 'POS Solo', 0, true)
      on conflict (restaurant_id, id) do nothing;
      ic_id := 'pos-solo-ic';
    end if;
    if ps_id is null then
      insert into public.inventory_production_sites (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-ps', 'Küche', 0, true)
      on conflict (restaurant_id, id) do nothing;
      ps_id := 'pos-solo-ps';
    end if;
    if br_id is null then
      insert into public.inventory_brands (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-br', 'Haus', 0, true)
      on conflict (restaurant_id, id) do nothing;
      br_id := 'pos-solo-br';
    end if;

    insert into public.inventory_ingredients (
      restaurant_id, id, name, unit, current_stock, supplier_id, category_id,
      production_site_id, brand_id, is_active
    ) values
      (rid, 'pos-solo-tomato', 'Tomaten', unit_id, 0, sup_id, ic_id, ps_id, br_id, true),
      (rid, 'pos-solo-onion', 'Zwiebeln', unit_id, 0, sup_id, ic_id, ps_id, br_id, true)
    on conflict (restaurant_id, id) do update set name = excluded.name, is_active = true;

    insert into public.menu_item_recipe_lines (menu_item_id, ingredient_id, amount, sort_order)
    values
      (main_id, 'pos-solo-tomato', 1, 0),
      (main_id, 'pos-solo-onion', 1, 1)
    on conflict (menu_item_id, ingredient_id) do update set amount = excluded.amount, sort_order = excluded.sort_order;

    raise notice 'seed_pos_solo_rich_menu: configured main % with sides+recipe', main_id;
  end if;
end $$;
