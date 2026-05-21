-- Diagnose Bestand/Bestellungen auf Live (idempotent, nur SELECT)

\echo '=== Restaurants ==='
select slug, id, name from public.restaurants order by slug;

\echo '=== User dreyer + Mitarbeit ==='
select u.email, p.active_restaurant_id, r.slug as active_slug, re.restaurant_id, re.role, re.is_active
from auth.users u
left join public.profiles p on p.id = u.id
left join public.restaurants r on r.id = p.active_restaurant_id
left join public.restaurant_employees re on re.profile_id = u.id
where u.email = 'dreyer@techlion.de';

\echo '=== Inventory counts per restaurant ==='
select r.slug,
  (select count(*) from public.inventory_suppliers s where s.restaurant_id = r.id) as suppliers,
  (select count(*) from public.inventory_ingredients i where i.restaurant_id = r.id) as ingredients,
  (select count(*) from public.inventory_purchase_orders po where po.restaurant_id = r.id) as orders
from public.restaurants r
order by r.slug;

\echo '=== Sample ingredients (first restaurant with ingredients) ==='
select r.slug, i.id, i.name, i.supplier_id,
  exists (
    select 1 from public.inventory_suppliers s
    where s.restaurant_id = i.restaurant_id and s.id = i.supplier_id
  ) as supplier_row_exists
from public.inventory_ingredients i
join public.restaurants r on r.id = i.restaurant_id
order by r.slug, i.name
limit 15;

\echo '=== RPC inventory_replace_purchase_orders (snippet) ==='
select case
  when pg_get_functiondef(p.oid) like '%auth_is_restaurant_staff%' then 'has_staff_check'
  else 'no_staff_check'
end as staff_check,
case
  when pg_get_functiondef(p.oid) like '%inventory_suppliers%' then 'has_supplier_upsert'
  else 'no_supplier_upsert'
end as supplier_upsert
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'inventory_replace_purchase_orders';
