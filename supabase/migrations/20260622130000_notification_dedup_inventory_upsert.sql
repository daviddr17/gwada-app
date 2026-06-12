-- Changelog: ein Eintrag pro Git-SHA (kein Doppel-Push durch parallele Syncs).
create unique index if not exists platform_changelog_entries_source_git_sha_uniq
  on public.platform_changelog_entries (source_git_sha)
  where source_git_sha is not null;

-- Bestand: Upsert statt Delete+Insert → Low-Stock-Trigger nur bei echten Neu-Zutaten / Updates.
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
    insert into public.inventory_ingredients (
      restaurant_id, id, name, unit, current_stock, low_stock_threshold,
      supplier_id, category_id, production_site_id, brand_id, is_active
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
      case when (ing ? 'active' and ing->'active' = 'false'::jsonb) then false else true end
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
      is_active = excluded.is_active;

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

-- Low-Stock-Push: nur beim Überschreiten der Schwelle nach unten (nicht bei Re-Insert).
create or replace function public.trg_emit_notification_event_inventory_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  day_bucket text;
  ref_key text;
begin
  if coalesce(new.is_active, true) is not true then
    return new;
  end if;

  if new.current_stock > new.low_stock_threshold then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.current_stock <= old.low_stock_threshold
      and old.low_stock_threshold = new.low_stock_threshold then
      return new;
    end if;
    if old.current_stock <= new.low_stock_threshold
      and new.current_stock <= new.low_stock_threshold then
      return new;
    end if;
  end if;

  day_bucket := to_char(timezone('utc', now()), 'YYYY-MM-DD');
  ref_key := new.id::text || ':' || day_bucket;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'inventory_low_stock',
    ref_key,
    jsonb_build_object(
      'ingredientId', new.id,
      'ingredientName', new.name,
      'currentStock', new.current_stock,
      'lowStockThreshold', new.low_stock_threshold,
      'unit', new.unit
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'inventory_low_stock'
      and e.reference_id = ref_key
      and e.restaurant_id = new.restaurant_id
  );

  return new;
end;
$$;
