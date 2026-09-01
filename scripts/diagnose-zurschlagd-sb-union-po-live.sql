-- Diagnose: Protokoll-Einträge ohne passende Bestellposition (zurschlagd / SB Union)
-- Idempotent: nur SELECT

\echo '=== Restaurant zurschlagd ==='
select id, slug, name from public.restaurants where slug = 'zurschlagd';

\echo '=== Offene Bestellungen SB Union ==='
select po.id, po.supplier_name, po.status, po.created_at::date,
  (select count(*) from public.inventory_purchase_order_lines l where l.order_id = po.id) as line_count,
  (select count(*) from public.inventory_purchase_order_log_entries g where g.order_id = po.id) as log_count
from public.inventory_purchase_orders po
join public.restaurants r on r.id = po.restaurant_id
where r.slug = 'zurschlagd'
  and po.supplier_name ilike '%SB Union%'
order by po.created_at desc;

\echo '=== add_to_order am 2026-09-01 ohne Position ==='
with z as (
  select id as restaurant_id from public.restaurants where slug = 'zurschlagd'
),
orders as (
  select po.id as order_id, po.supplier_name, po.status
  from public.inventory_purchase_orders po
  join z on z.restaurant_id = po.restaurant_id
  where po.supplier_name ilike '%SB Union%'
),
log_adds as (
  select
    o.order_id,
    o.supplier_name,
    o.status,
    g.sort_order,
    g.entry->>'at' as at,
    g.entry->>'ingredientId' as ingredient_id,
    g.entry->>'ingredientName' as ingredient_name,
    (g.entry->>'quantity')::numeric as quantity,
    g.entry->>'unitLabel' as unit_label
  from orders o
  join public.inventory_purchase_order_log_entries g on g.order_id = o.order_id
  where g.entry->>'kind' = 'add_to_order'
    and (g.entry->>'at')::timestamptz >= '2026-09-01'
    and (g.entry->>'at')::timestamptz < '2026-09-02'
)
select la.*
from log_adds la
where not exists (
  select 1
  from public.inventory_purchase_order_lines l
  where l.order_id = la.order_id
    and l.ingredient_id = la.ingredient_id
)
order by la.at;
