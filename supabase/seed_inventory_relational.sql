-- Inventory taxonomy + ingredients for gwada-demo (matches lib/data/inventory-seeds.ts).
-- Depends on public.restaurants slug gwada-demo.

do $$
declare
  rid uuid;
begin
  select id into rid from public.restaurants where slug = 'gwada-demo' limit 1;
  if rid is null then
    raise notice 'seed_inventory_relational: no gwada-demo restaurant, skip';
    return;
  end if;

  insert into public.inventory_suppliers (restaurant_id, id, name, sort_order, is_active) values
    (rid, 'sup-1', 'Großmarkt Nord', 0, true),
    (rid, 'sup-2', 'Bio-Lieferant Süd', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_ingredient_categories (restaurant_id, id, name, sort_order, is_active) values
    (rid, 'ic-1', 'Trockenware', 0, true),
    (rid, 'ic-2', 'Kühlung', 1, true),
    (rid, 'ic-3', 'Tiefkühl', 2, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_production_sites (restaurant_id, id, name, sort_order, is_active) values
    (rid, 'ps-1', 'Hauptküche', 0, true),
    (rid, 'ps-2', 'Vorbereitung', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_brands (restaurant_id, id, name, sort_order, is_active) values
    (rid, 'br-1', 'Hausmarke', 0, true),
    (rid, 'br-2', 'Import', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_units (restaurant_id, id, name, sort_order, is_active) values
    (rid, 'g', 'Gramm (g)', 0, true),
    (rid, 'l', 'Liter (l)', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_ingredients (
    restaurant_id, id, name, unit, current_stock, supplier_id, category_id, production_site_id, brand_id, is_active
  ) values
    (rid, 'ing-1', 'Jasminreis', 'g', 5000, 'sup-1', 'ic-1', 'ps-1', 'br-1', true),
    (rid, 'ing-2', 'Kokosmilch', 'l', 12, 'sup-2', 'ic-2', 'ps-1', 'br-2', true)
  on conflict (restaurant_id, id) do nothing;
end $$;
