-- Diagnose: Protokoll vs Positionen (zurschlagd / SB Union)
-- Idempotent: nur SELECT

\echo '=== Restaurant ==='
select id, slug from public.restaurants where slug = 'zurschlagd';

\echo '=== SB Union Bestellungen (alle Status) ==='
select po.id, po.status, po.created_at::date,
  (select count(*) from public.inventory_purchase_order_lines l where l.order_id = po.id) as lines,
  (select count(*) from public.inventory_purchase_order_log_entries g where g.order_id = po.id) as log_rows
from public.inventory_purchase_orders po
join public.restaurants r on r.id = po.restaurant_id
where r.slug = 'zurschlagd' and po.supplier_name ilike '%SB Union%'
order by po.created_at desc;

\echo '=== Heute add_to_order: Einträge vs eindeutige Zutaten vs fehlende Position ==='
with z as (select id as restaurant_id from public.restaurants where slug = 'zurschlagd'),
target as (
  select po.id as order_id, po.status
  from public.inventory_purchase_orders po
  join z on z.restaurant_id = po.restaurant_id
  where po.supplier_name ilike '%SB Union%' and po.status = 'open'
  order by po.created_at desc
  limit 1
),
adds as (
  select
    t.order_id,
    g.entry->>'id' as log_id,
    g.entry->>'ingredientId' as ingredient_id,
    g.entry->>'ingredientName' as ingredient_name,
    (g.entry->>'quantity')::numeric as quantity,
    g.entry->>'at' as at
  from target t
  join public.inventory_purchase_order_log_entries g on g.order_id = t.order_id
  where g.entry->>'kind' = 'add_to_order'
    and (g.entry->>'at')::timestamptz >= date_trunc('day', timezone('Europe/Berlin', now()))
)
select
  (select count(*) from adds) as add_log_rows_today,
  (select count(distinct ingredient_id) from adds) as unique_ingredients_in_log_today,
  (select count(*) from public.inventory_purchase_order_lines l join target t on t.order_id = l.order_id) as line_rows,
  (select count(*) from adds a where not exists (
    select 1 from public.inventory_purchase_order_lines l
    where l.order_id = a.order_id and l.ingredient_id = a.ingredient_id
  )) as log_ingredients_without_line;

\echo '=== Fehlende Positionen (Detail) ==='
with z as (select id as restaurant_id from public.restaurants where slug = 'zurschlagd'),
target as (
  select po.id as order_id
  from public.inventory_purchase_orders po
  join z on z.restaurant_id = po.restaurant_id
  where po.supplier_name ilike '%SB Union%' and po.status = 'open'
  order by po.created_at desc
  limit 1
),
adds as (
  select distinct g.entry->>'ingredientId' as ingredient_id, g.entry->>'ingredientName' as ingredient_name
  from target t
  join public.inventory_purchase_order_log_entries g on g.order_id = t.order_id
  where g.entry->>'kind' = 'add_to_order'
    and (g.entry->>'at')::timestamptz >= date_trunc('day', timezone('Europe/Berlin', now()))
)
select a.ingredient_id, a.ingredient_name
from adds a
where not exists (
  select 1 from public.inventory_purchase_order_lines l
  join target t on t.order_id = l.order_id
  where l.ingredient_id = a.ingredient_id
)
order by a.ingredient_name;
