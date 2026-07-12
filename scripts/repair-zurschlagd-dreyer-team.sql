-- Idempotent: Petra + Daniel Dreyer (und alle gleichen Fälle) bei zurschlagd ins Team.
-- profile_id gesetzt, aber keine aktive restaurant_employees-Zeile.

do $$
declare
  v_rid uuid;
  v_repaired int := 0;
  v_row record;
  v_emp_id uuid;
  v_position_id uuid;
begin
  select id into v_rid
  from public.restaurants
  where slug = 'zurschlagd'
  limit 1;

  if v_rid is null then
    raise notice 'repair-zurschlagd: restaurant zurschlagd nicht gefunden';
    return;
  end if;

  for v_row in
    select
      rs.id as staff_id,
      rs.restaurant_id,
      rs.profile_id,
      rs.given_name,
      rs.family_name,
      coalesce(
        rs.restaurant_position_id,
        (
          select rp.id
          from public.restaurant_positions rp
          where rp.restaurant_id = rs.restaurant_id
            and rp.slug = 'other'
          limit 1
        )
      ) as position_id
    from public.restaurant_staff rs
    where rs.restaurant_id = v_rid
      and rs.profile_id is not null
      and (
        (rs.given_name ilike 'Petra' and rs.family_name ilike 'Dreyer')
        or (rs.given_name ilike 'Daniel' and rs.family_name ilike 'Dreyer')
      )
      and not exists (
        select 1
        from public.restaurant_employees re
        where re.restaurant_id = rs.restaurant_id
          and re.profile_id = rs.profile_id
          and re.is_active = true
      )
  loop
    if v_row.position_id is null then
      raise notice 'repair-zurschlagd: keine Position für % % (staff %)',
        v_row.given_name, v_row.family_name, v_row.staff_id;
      continue;
    end if;

    select re.id
    into v_emp_id
    from public.restaurant_employees re
    where re.restaurant_id = v_row.restaurant_id
      and re.profile_id = v_row.profile_id
    limit 1;

    if v_emp_id is not null then
      update public.restaurant_employees
      set
        staff_id = v_row.staff_id,
        position_id = v_row.position_id,
        is_active = true
      where id = v_emp_id;
    else
      insert into public.restaurant_employees (
        restaurant_id,
        profile_id,
        staff_id,
        position_id,
        role,
        is_active
      )
      select
        v_row.restaurant_id,
        v_row.profile_id,
        v_row.staff_id,
        v_row.position_id,
        case
          when rp.slug in (
            'owner', 'manager', 'host', 'server', 'kitchen', 'other'
          ) then rp.slug::public.employee_role
          else 'other'::public.employee_role
        end,
        true
      from public.restaurant_positions rp
      where rp.id = v_row.position_id
      returning id into v_emp_id;
    end if;

    if v_emp_id is null then
      raise notice 'repair-zurschlagd: employee insert fehlgeschlagen für % %',
        v_row.given_name, v_row.family_name;
      continue;
    end if;

    update public.restaurant_staff
    set
      employee_id = v_emp_id,
      restaurant_position_id = v_row.position_id
    where id = v_row.staff_id;

    update public.profiles
    set
      active_restaurant_id = coalesce(active_restaurant_id, v_row.restaurant_id),
      updated_at = timezone('utc', now())
    where id = v_row.profile_id
      and active_restaurant_id is null;

    update public.restaurant_staff_invites
    set
      status = 'accepted',
      accepted_at = coalesce(accepted_at, timezone('utc', now())),
      accepted_by = coalesce(accepted_by, v_row.profile_id)
    where staff_id = v_row.staff_id
      and status = 'pending';

    v_repaired := v_repaired + 1;
    raise notice 'repair-zurschlagd: % % repariert (staff %, employee %)',
      v_row.given_name, v_row.family_name, v_row.staff_id, v_emp_id;
  end loop;

  raise notice 'repair-zurschlagd: % Mitarbeiter repariert', v_repaired;
end $$;
