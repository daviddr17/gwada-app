-- Allow the restaurant owner_profile to insert their first (and further) employees
-- before any restaurant_employees row exists for them.

drop policy if exists "restaurant_employees_insert_by_owner" on public.restaurant_employees;

create policy "restaurant_employees_insert_by_owner"
  on public.restaurant_employees for insert
  with check (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner']::public.employee_role[]
    )
    or (
      profile_id = (select auth.uid())
      and exists (
        select 1 from public.restaurants r
        where r.id = restaurant_employees.restaurant_id
          and r.owner_profile_id = (select auth.uid())
      )
    )
  );
