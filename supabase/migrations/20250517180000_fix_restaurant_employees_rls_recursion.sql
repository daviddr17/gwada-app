-- RLS on restaurant_employees used "exists (select ... from restaurant_employees)".
-- That re-applies the same SELECT policy → infinite recursion.
-- SECURITY DEFINER + table owner bypasses RLS inside the function body.

create or replace function public.auth_is_restaurant_staff(
  p_restaurant_id uuid,
  p_roles public.employee_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_employees re
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and (
        p_roles is null
        or re.role = any (p_roles)
      )
  );
$$;

comment on function public.auth_is_restaurant_staff(uuid, public.employee_role[]) is
  'True if auth.uid() is an active employee at the restaurant; optional role filter. Used by RLS to avoid self-referential restaurant_employees subqueries.';

revoke all on function public.auth_is_restaurant_staff(uuid, public.employee_role[]) from public;
grant execute on function public.auth_is_restaurant_staff(uuid, public.employee_role[]) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Drop policies that subquery restaurant_employees (directly or via orders join)
-- ---------------------------------------------------------------------------

drop policy if exists "restaurants_select_public_or_staff" on public.restaurants;
drop policy if exists "restaurants_update_owner_or_manager" on public.restaurants;

drop policy if exists "restaurant_employees_select_same_restaurant" on public.restaurant_employees;
drop policy if exists "restaurant_employees_insert_by_manager" on public.restaurant_employees;
drop policy if exists "restaurant_employees_update_managers" on public.restaurant_employees;
drop policy if exists "restaurant_employees_delete_managers" on public.restaurant_employees;

drop policy if exists "dining_tables_select_staff" on public.dining_tables;
drop policy if exists "dining_tables_write_staff" on public.dining_tables;

drop policy if exists "reservations_select_guest_or_staff" on public.reservations;
drop policy if exists "reservations_insert_guest_or_staff" on public.reservations;
drop policy if exists "reservations_update_staff_or_guest" on public.reservations;

drop policy if exists "orders_select_staff" on public.orders;
drop policy if exists "orders_write_staff" on public.orders;

drop policy if exists "order_items_access_via_order" on public.order_items;

drop policy if exists "restaurant_app_state_staff_all" on public.restaurant_app_state;

-- ---------------------------------------------------------------------------
-- Recreate with auth_is_restaurant_staff(...)
-- ---------------------------------------------------------------------------

create policy "restaurants_select_public_or_staff"
  on public.restaurants for select
  using (
    is_published
    or (select auth.uid()) = owner_profile_id
    or public.auth_is_restaurant_staff(id)
  );

create policy "restaurants_update_owner_or_manager"
  on public.restaurants for update
  using (
    (select auth.uid()) = owner_profile_id
    or public.auth_is_restaurant_staff(
      id,
      array['owner', 'manager']::public.employee_role[]
    )
  );

create policy "restaurant_employees_select_same_restaurant"
  on public.restaurant_employees for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy "restaurant_employees_insert_by_manager"
  on public.restaurant_employees for insert
  with check (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager']::public.employee_role[]
    )
  );

create policy "restaurant_employees_update_managers"
  on public.restaurant_employees for update
  using (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager']::public.employee_role[]
    )
  )
  with check (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager']::public.employee_role[]
    )
  );

create policy "restaurant_employees_delete_managers"
  on public.restaurant_employees for delete
  using (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager']::public.employee_role[]
    )
  );

create policy "dining_tables_select_staff"
  on public.dining_tables for select
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    or exists (
      select 1 from public.restaurants r
      where r.id = dining_tables.restaurant_id
        and r.is_published
    )
  );

create policy "dining_tables_write_staff"
  on public.dining_tables for all
  using (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager', 'host']::public.employee_role[]
    )
  )
  with check (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager', 'host']::public.employee_role[]
    )
  );

create policy "reservations_select_guest_or_staff"
  on public.reservations for select
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_is_restaurant_staff(restaurant_id)
  );

create policy "reservations_insert_guest_or_staff"
  on public.reservations for insert
  with check (
    guest_profile_id is null
    or guest_profile_id = (select auth.uid())
    or public.auth_is_restaurant_staff(restaurant_id)
  );

create policy "reservations_update_staff_or_guest"
  on public.reservations for update
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_is_restaurant_staff(restaurant_id)
  );

create policy "orders_select_staff"
  on public.orders for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy "orders_write_staff"
  on public.orders for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create policy "order_items_access_via_order"
  on public.order_items for all
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.auth_is_restaurant_staff(o.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.auth_is_restaurant_staff(o.restaurant_id)
    )
  );

create policy "restaurant_app_state_staff_all"
  on public.restaurant_app_state for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));
