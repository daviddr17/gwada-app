-- Authenticated staff only for workspace data (no anon gwada-demo bypass).
-- Team changes: only restaurant owners; at least one active owner per restaurant.

-- ---------------------------------------------------------------------------
-- Drop anon demo policy on restaurant_app_state
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant_app_state_demo_anon_all" on public.restaurant_app_state;

-- ---------------------------------------------------------------------------
-- Menu: staff only
-- ---------------------------------------------------------------------------
drop policy if exists "menu_categories_access" on public.menu_categories;
drop policy if exists "menu_tags_access" on public.menu_tags;
drop policy if exists "menu_allergens_access" on public.menu_allergens;
drop policy if exists "menu_items_access" on public.menu_items;
drop policy if exists "menu_item_tags_access" on public.menu_item_tags;
drop policy if exists "menu_item_allergens_access" on public.menu_item_allergens;
drop policy if exists "menu_item_recipe_lines_access" on public.menu_item_recipe_lines;

create policy "menu_categories_access"
  on public.menu_categories for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "menu_tags_access"
  on public.menu_tags for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "menu_allergens_access"
  on public.menu_allergens for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "menu_items_access"
  on public.menu_items for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "menu_item_tags_access"
  on public.menu_item_tags for all
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_tags.menu_item_id
        and public.auth_is_restaurant_staff(mi.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_tags.menu_item_id
        and public.auth_is_restaurant_staff(mi.restaurant_id)
    )
  );

create policy "menu_item_allergens_access"
  on public.menu_item_allergens for all
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_allergens.menu_item_id
        and public.auth_is_restaurant_staff(mi.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_allergens.menu_item_id
        and public.auth_is_restaurant_staff(mi.restaurant_id)
    )
  );

create policy "menu_item_recipe_lines_access"
  on public.menu_item_recipe_lines for all
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_recipe_lines.menu_item_id
        and public.auth_is_restaurant_staff(mi.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_recipe_lines.menu_item_id
        and public.auth_is_restaurant_staff(mi.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Inventory: staff only
-- ---------------------------------------------------------------------------
drop policy if exists "inventory_suppliers_access" on public.inventory_suppliers;
drop policy if exists "inventory_brands_access" on public.inventory_brands;
drop policy if exists "inventory_ingredient_categories_access" on public.inventory_ingredient_categories;
drop policy if exists "inventory_production_sites_access" on public.inventory_production_sites;
drop policy if exists "inventory_units_access" on public.inventory_units;
drop policy if exists "inventory_ingredients_access" on public.inventory_ingredients;
drop policy if exists "inventory_stock_log_access" on public.inventory_stock_log_entries;
drop policy if exists "inventory_purchase_orders_access" on public.inventory_purchase_orders;
drop policy if exists "inventory_purchase_order_lines_access" on public.inventory_purchase_order_lines;
drop policy if exists "inventory_purchase_order_log_access" on public.inventory_purchase_order_log_entries;

create policy "inventory_suppliers_access"
  on public.inventory_suppliers for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_brands_access"
  on public.inventory_brands for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_ingredient_categories_access"
  on public.inventory_ingredient_categories for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_production_sites_access"
  on public.inventory_production_sites for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_units_access"
  on public.inventory_units for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_ingredients_access"
  on public.inventory_ingredients for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_stock_log_access"
  on public.inventory_stock_log_entries for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_purchase_orders_access"
  on public.inventory_purchase_orders for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_purchase_order_lines_access"
  on public.inventory_purchase_order_lines for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "inventory_purchase_order_log_access"
  on public.inventory_purchase_order_log_entries for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Inventory RPCs: no anon
-- ---------------------------------------------------------------------------
revoke execute on function public.inventory_replace_ingredients(uuid, jsonb) from anon;
revoke execute on function public.inventory_replace_purchase_orders(uuid, jsonb) from anon;

-- ---------------------------------------------------------------------------
-- restaurant_employees: only owners may insert / update / delete rows
-- (all staff may still select via existing select policy)
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant_employees_insert_by_manager" on public.restaurant_employees;
drop policy if exists "restaurant_employees_update_managers" on public.restaurant_employees;
drop policy if exists "restaurant_employees_delete_managers" on public.restaurant_employees;

create policy "restaurant_employees_insert_by_owner"
  on public.restaurant_employees for insert
  with check (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner']::public.employee_role[]
    )
  );

create policy "restaurant_employees_update_owners"
  on public.restaurant_employees for update
  using (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner']::public.employee_role[]
    )
  )
  with check (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner']::public.employee_role[]
    )
  );

create policy "restaurant_employees_delete_owners"
  on public.restaurant_employees for delete
  using (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner']::public.employee_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- At least one active owner per restaurant (admin / Inhaber)
-- ---------------------------------------------------------------------------
create or replace function public.restaurant_employees_enforce_min_one_owner()
returns trigger
language plpgsql
as $$
declare
  rid uuid;
  n int;
begin
  rid := coalesce(new.restaurant_id, old.restaurant_id);
  select count(*) into n
  from public.restaurant_employees
  where restaurant_id = rid
    and is_active = true
    and role = 'owner';

  if n < 1 then
    raise exception 'Jedes Restaurant braucht mindestens einen Inhaber (Rolle „owner“).';
  end if;

  return null;
end;
$$;

drop trigger if exists restaurant_employees_enforce_min_one_owner_iud
  on public.restaurant_employees;

create constraint trigger restaurant_employees_enforce_min_one_owner_iud
  after insert or update or delete on public.restaurant_employees
  deferrable initially deferred
  for each row
  execute function public.restaurant_employees_enforce_min_one_owner();

comment on function public.restaurant_employees_enforce_min_one_owner() is
  'Ensures each restaurant keeps at least one active employee with role owner.';
