-- Diagnose zurschlagd purchase orders after PO overwrite incident.
-- Read-only. Use before/after recover-zurschlag-purchase-orders.ts

\echo === restaurant ===
select id, slug, name from public.restaurants where slug = 'zurschlagd';

\echo === PO status overview ===
select o.id,
       o.supplier_name,
       o.status,
       o.created_at,
       o.delivery_date,
       (select count(*) from public.inventory_purchase_order_lines ln
        where ln.restaurant_id = o.restaurant_id and ln.order_id = o.id) as line_count,
       (select count(*) from public.inventory_purchase_order_log_entries lg
        where lg.restaurant_id = o.restaurant_id and lg.order_id = o.id) as log_count
from public.inventory_purchase_orders o
where o.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
order by o.created_at desc;

\echo === Regressed: open/ordered but log contains closed ===
select o.id,
       o.supplier_name,
       o.status as db_status,
       max(lg.entry->>'at') filter (where lg.entry->>'kind' = 'status_change'
         and lg.entry->>'toStatus' = 'closed') as last_closed_at
from public.inventory_purchase_orders o
join public.inventory_purchase_order_log_entries lg
  on lg.restaurant_id = o.restaurant_id and lg.order_id = o.id
where o.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and o.status in ('open', 'ordered')
group by o.id, o.supplier_name, o.status
having bool_or(lg.entry->>'kind' = 'status_change' and lg.entry->>'toStatus' = 'closed');

\echo === Lines missing delivery but log has marked_delivered ===
select o.id as order_id,
       o.supplier_name,
       ln.id as line_id,
       ln.ingredient_name,
       ln.delivered_at,
       ln.delivery_status
from public.inventory_purchase_orders o
join public.inventory_purchase_order_lines ln
  on ln.restaurant_id = o.restaurant_id and ln.order_id = o.id
where o.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and ln.delivered_at is null
  and ln.delivery_status is null
  and exists (
    select 1
    from public.inventory_purchase_order_log_entries lg
    where lg.restaurant_id = o.restaurant_id
      and lg.order_id = o.id
      and lg.entry->>'kind' = 'marked_delivered'
      and lg.entry->>'lineId' = ln.id
  );

\echo === Recent status_change log entries ===
select o.supplier_name,
       lg.entry->>'at' as at,
       lg.entry->>'fromStatus' as from_status,
       lg.entry->>'toStatus' as to_status
from public.inventory_purchase_order_log_entries lg
join public.inventory_purchase_orders o
  on o.restaurant_id = lg.restaurant_id and o.id = lg.order_id
where lg.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and lg.entry->>'kind' = 'status_change'
order by lg.entry->>'at' desc
limit 20;
