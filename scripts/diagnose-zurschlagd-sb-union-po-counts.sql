-- Quick: unique ingredients in full SB Union open order log vs line count
with target as (
  select po.id as order_id
  from public.inventory_purchase_orders po
  join public.restaurants r on r.id = po.restaurant_id
  where r.slug = 'zurschlagd'
    and po.supplier_name ilike '%SB Union%'
    and po.status = 'open'
  order by po.created_at desc
  limit 1
)
select
  (select count(*) from public.inventory_purchase_order_log_entries g join target t on t.order_id = g.order_id where g.entry->>'kind' = 'add_to_order') as add_log_rows,
  (select count(distinct g.entry->>'ingredientId') from public.inventory_purchase_order_log_entries g join target t on t.order_id = g.order_id where g.entry->>'kind' = 'add_to_order') as unique_ingredients_in_add_log,
  (select count(*) from public.inventory_purchase_order_lines l join target t on t.order_id = l.order_id) as line_rows,
  (select count(*) from public.inventory_purchase_order_log_entries g join target t on t.order_id = g.order_id where g.entry->>'kind' = 'add_to_order' and (g.entry->>'at')::timestamptz >= '2026-09-01'::timestamptz and (g.entry->>'at') < '2026-09-02'::timestamptz) as add_rows_utc_sept1;
