-- Zusatzstoffe / Allergene: länderspezifische Kennzeichnungscodes an Zutaten und Gerichten.

alter table public.inventory_ingredients
  add column if not exists marking_codes text[] not null default '{}'::text[];

comment on column public.inventory_ingredients.marking_codes is
  'Pflichtkennzeichnung (Zusatzstoffe/Allergene) als Codes der Länderliste, z. B. a, 1.';

alter table public.menu_items
  add column if not exists marking_codes text[] not null default '{}'::text[];

comment on column public.menu_items.marking_codes is
  'Zusätzliche Kennzeichnung am Gericht (neben Aggregation aus Rezept-Zutaten).';

create index if not exists inventory_ingredients_marking_codes_gin
  on public.inventory_ingredients using gin (marking_codes);

create index if not exists menu_items_marking_codes_gin
  on public.menu_items using gin (marking_codes);

-- AI-Nutzung: Suggest Zusatzstoffe
alter table public.restaurant_ai_usage_events
  drop constraint if exists restaurant_ai_usage_events_source_check;

alter table public.restaurant_ai_usage_events
  add constraint restaurant_ai_usage_events_source_check
  check (source in ('autopilot', 'assistant', 'brand_learn', 'menu_markings'));

-- Snapshot-Replace um markingCodes erweitern (fehlender Key → bestehender Wert).
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
  v_article text;
  v_image text;
  v_markings text[];
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text)::bigint);
  perform set_config('gwada.inventory_bulk_replace', '1', true);

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

    v_article := null;
    if ing ? 'articleNumber' then
      v_article := nullif(btrim(ing->>'articleNumber'), '');
    end if;

    v_image := null;
    if ing ? 'imagePath' then
      v_image := nullif(btrim(ing->>'imagePath'), '');
    end if;

    v_markings := '{}'::text[];
    if ing ? 'markingCodes' and jsonb_typeof(ing->'markingCodes') = 'array' then
      select coalesce(array_agg(x), '{}'::text[])
      into v_markings
      from (
        select distinct btrim(elem) as x
        from jsonb_array_elements_text(ing->'markingCodes') as elem
        where btrim(elem) <> ''
      ) s;
    end if;

    insert into public.inventory_ingredients (
      restaurant_id, id, name, unit, current_stock, low_stock_threshold,
      supplier_id, category_id, production_site_id, brand_id, is_active,
      purchase_unit_price, article_number, image_path, marking_codes
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
      v_price,
      v_article,
      v_image,
      case when ing ? 'markingCodes' then v_markings else '{}'::text[] end
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
      purchase_unit_price = excluded.purchase_unit_price,
      article_number = case
        when ing ? 'articleNumber' then excluded.article_number
        else inventory_ingredients.article_number
      end,
      image_path = case
        when ing ? 'imagePath' then excluded.image_path
        else inventory_ingredients.image_path
      end,
      marking_codes = case
        when ing ? 'markingCodes' then excluded.marking_codes
        else inventory_ingredients.marking_codes
      end;

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

  perform set_config('gwada.inventory_bulk_replace', '0', true);
  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
end;
$$;
